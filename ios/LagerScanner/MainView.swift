import SwiftUI

enum ActiveSheet: Identifiable {
    case booking(Item)
    case createItem(String)

    var id: String {
        switch self {
        case .booking(let item): return "booking-\(item.id)"
        case .createItem(let barcode): return "create-\(barcode)"
        }
    }
}

struct MainView: View {
    var body: some View {
        TabView {
            SingleScanView()
                .tabItem {
                    Label("Scannen", systemImage: "barcode.viewfinder")
                }
            PackageView()
                .tabItem {
                    Label("Paket", systemImage: "shippingbox")
                }
        }
    }
}

private struct SingleScanView: View {
    @EnvironmentObject private var api: APIClient
    @State private var activeSheet: ActiveSheet?
    @State private var manualBarcode = ""
    @State private var error: String?
    @State private var scannerActive = true
    @State private var missingBarcode: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ZStack {
                    if scannerActive {
                        BarcodeScannerView { code in
                            Task { await lookup(code) }
                        }
                    } else {
                        Color.black
                    }
                    VStack {
                        Spacer()
                        Text("Barcode vor die Kamera halten")
                            .font(.footnote)
                            .padding(8)
                            .background(.black.opacity(0.6))
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                            .padding(.bottom, 12)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                HStack {
                    TextField("Barcode manuell eingeben", text: $manualBarcode)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.asciiCapable)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .onSubmit { Task { await lookup(manualBarcode) } }
                    Button("Suchen") {
                        Task { await lookup(manualBarcode) }
                    }
                    .disabled(manualBarcode.isEmpty)
                }
                .padding()
            }
            .navigationTitle("Scannen")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Abmelden") {
                        Task { await api.logout() }
                    }
                }
            }
            .alert("Fehler", isPresented: .init(get: { error != nil }, set: { if !$0 { error = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error ?? "")
            }
            .alert(
                "Artikel nicht gefunden",
                isPresented: .init(get: { missingBarcode != nil }, set: { if !$0 { missingBarcode = nil } })
            ) {
                Button("Abbrechen", role: .cancel) { missingBarcode = nil }
                Button("Anlegen") {
                    if let code = missingBarcode {
                        scannerActive = false
                        activeSheet = .createItem(code)
                    }
                    missingBarcode = nil
                }
            } message: {
                Text("Kein Artikel mit Barcode „\(missingBarcode ?? "")“ gefunden. Jetzt anlegen?")
            }
            .sheet(item: $activeSheet, onDismiss: { scannerActive = true }) { sheet in
                switch sheet {
                case .booking(let item):
                    BookingView(item: item)
                        .environmentObject(api)
                case .createItem(let barcode):
                    ItemCreateView(barcode: barcode) { item in
                        activeSheet = .booking(item)
                    }
                    .environmentObject(api)
                }
            }
        }
    }

    private func lookup(_ code: String) async {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, activeSheet == nil else { return }
        do {
            let item = try await api.itemByBarcode(trimmed)
            scannerActive = false
            activeSheet = .booking(item)
            manualBarcode = ""
        } catch APIClient.APIError.notFound {
            missingBarcode = trimmed
        } catch {
            self.error = error.localizedDescription
        }
    }
}
