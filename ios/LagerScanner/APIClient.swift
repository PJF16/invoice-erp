import Foundation

@MainActor
final class APIClient: ObservableObject {
    @Published var isLoggedIn = false
    @Published var baseURLString: String {
        didSet { UserDefaults.standard.set(baseURLString, forKey: "baseURL") }
    }

    private let session = URLSession.shared

    // Der Login-POST antwortet mit einem 302 (NextAuth) — dem Redirect nicht
    // folgen, das Session-Cookie ist zu dem Zeitpunkt bereits gesetzt.
    private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession, task: URLSessionTask,
                        willPerformHTTPRedirection response: HTTPURLResponse,
                        newRequest request: URLRequest,
                        completionHandler: @escaping (URLRequest?) -> Void) {
            completionHandler(nil)
        }
    }
    private let noRedirectDelegate = NoRedirectDelegate()

    init() {
        baseURLString = UserDefaults.standard.string(forKey: "baseURL") ?? "http://192.168.0.10:3000"
        Task { await checkSession() }
    }

    private var baseURL: URL? {
        var trimmed = baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if !trimmed.contains("://") {
            trimmed = "https://" + trimmed
        }
        guard let url = URL(string: trimmed), let scheme = url.scheme,
              (scheme == "http" || scheme == "https"), url.host != nil else {
            return nil
        }
        return url
    }

    enum APIError: LocalizedError {
        case invalidURL
        case loginFailed
        case server(String)
        case notFound

        var errorDescription: String? {
            switch self {
            case .invalidURL: return "Ungültige Server-Adresse."
            case .loginFailed: return "E-Mail oder Passwort ist falsch."
            case .server(let message): return message
            case .notFound: return "Nicht gefunden."
            }
        }
    }

    // MARK: - Auth (NextAuth Credentials-Flow, Session-Cookie via URLSession)

    func login(email: String, password: String) async throws {
        guard let base = baseURL else { throw APIError.invalidURL }

        do {
            let (csrfData, _) = try await session.data(from: base.appending(path: "/api/auth/csrf"))
            guard let csrf = try JSONSerialization.jsonObject(with: csrfData) as? [String: String],
                  let csrfToken = csrf["csrfToken"] else {
                throw APIError.server("Server nicht erreichbar oder keine Lagerverwaltung.")
            }

            var request = URLRequest(url: base.appending(path: "/api/auth/callback/credentials"))
            request.httpMethod = "POST"
            request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            let form = [
                "csrfToken": csrfToken,
                "email": email,
                "password": password,
            ]
            request.httpBody = form
                .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "")" }
                .joined(separator: "&")
                .data(using: .utf8)
            _ = try await session.data(for: request, delegate: noRedirectDelegate)
        } catch let error as APIError {
            throw error
        } catch let error as URLError {
            throw APIError.server("Netzwerkfehler beim Verbinden mit \(base.absoluteString): \(error.localizedDescription) (\(error.code.rawValue))")
        }

        await checkSession()
        if !isLoggedIn { throw APIError.loginFailed }
    }

    func checkSession() async {
        guard let base = baseURL else {
            isLoggedIn = false
            return
        }
        do {
            let (data, _) = try await session.data(from: base.appending(path: "/api/auth/session"))
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            isLoggedIn = json?["user"] != nil
        } catch {
            isLoggedIn = false
        }
    }

    func logout() async {
        if let base = baseURL {
            HTTPCookieStorage.shared.cookies(for: base)?.forEach {
                HTTPCookieStorage.shared.deleteCookie($0)
            }
        }
        isLoggedIn = false
    }

    // MARK: - Requests

    private func get<T: Decodable>(_ path: String) async throws -> T {
        guard let base = baseURL else { throw APIError.invalidURL }
        let (data, response) = try await session.data(from: base.appending(path: path))
        return try decode(data: data, response: response)
    }

    private func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        guard let base = baseURL else { throw APIError.invalidURL }
        var request = URLRequest(url: base.appending(path: path))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: request)
        return try decode(data: data, response: response)
    }

    private func decode<T: Decodable>(data: Data, response: URLResponse) throws -> T {
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 404 { throw APIError.notFound }
        if status == 401 {
            isLoggedIn = false
            throw APIError.server("Sitzung abgelaufen — bitte neu anmelden.")
        }
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(APIErrorResponse.self, from: data))?.error
            throw APIError.server(message ?? "Serverfehler (\(status))")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    func itemByBarcode(_ code: String) async throws -> Item {
        let encoded = code.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? code
        return try await get("/api/items/by-barcode/\(encoded)")
    }

    func createItem(_ item: ItemCreateRequest) async throws -> Item {
        try await post("/api/items", body: item)
    }

    func warehouses() async throws -> [Warehouse] {
        try await get("/api/warehouses")
    }

    func suppliers() async throws -> [String] {
        try await get("/api/suppliers")
    }

    func movementCustomers() async throws -> [CustomerSummary] {
        try await get("/api/movement-customers")
    }

    func createDeliveryNote(_ request: DeliveryNoteRequest) async throws -> DeliveryNoteResponse {
        try await post("/api/delivery-notes", body: request)
    }

    @discardableResult
    func bookMovement(_ movement: MovementRequest) async throws -> Data {
        guard let base = baseURL else { throw APIError.invalidURL }
        var request = URLRequest(url: base.appending(path: "/api/movements"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(movement)
        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(APIErrorResponse.self, from: data))?.error
            throw APIError.server(message ?? "Buchung fehlgeschlagen (\(status))")
        }
        return data
    }
}
