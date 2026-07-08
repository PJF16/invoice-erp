import SwiftUI

struct MainView: View {
    @EnvironmentObject private var api: APIClient
    @State private var scannedItem: Item?
    @State private var manualBarcode = ""
    @State private var error: String?
    @State private var scannerActive = true

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
            .sheet(item: $scannedItem, onDismiss: { scannerActive = true }) { item in
                BookingView(item: item)
                    .environmentObject(api)
            }
        }
    }

    private func lookup(_ code: String) async {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, scannedItem == nil else { return }
        do {
            let item = try await api.itemByBarcode(trimmed)
            scannerActive = false
            scannedItem = item
            manualBarcode = ""
        } catch APIClient.APIError.notFound {
            error = "Kein Artikel mit Barcode „\(trimmed)“ gefunden. Lege ihn zuerst in der Weboberfläche an."
        } catch {
            self.error = error.localizedDescription
        }
    }
}
