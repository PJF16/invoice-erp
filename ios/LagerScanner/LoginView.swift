import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var api: APIClient
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("https://lager.meine-firma.de", text: $api.baseURLString)
                        .keyboardType(.URL)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                }
                Section("Anmeldung") {
                    TextField("E-Mail", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.username)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                    SecureField("Passwort", text: $password)
                        .textContentType(.password)
                }
                if let error {
                    Text(error).foregroundStyle(.red)
                }
                Button {
                    Task { await login() }
                } label: {
                    if loading {
                        ProgressView()
                    } else {
                        Text("Anmelden").frame(maxWidth: .infinity)
                    }
                }
                .disabled(loading || email.isEmpty || password.isEmpty)
            }
            .navigationTitle("Lager")
        }
    }

    private func login() async {
        error = nil
        loading = true
        defer { loading = false }
        do {
            try await api.login(email: email, password: password)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
