import SwiftUI

struct ItemCreateView: View {
    @EnvironmentObject private var api: APIClient
    @Environment(\.dismiss) private var dismiss

    let barcode: String
    let onCreated: (Item) -> Void

    @State private var name = ""
    @State private var sku = ""
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Barcode", value: barcode)
                }
                Section("Artikel") {
                    TextField("Name", text: $name)
                    TextField("SKU (optional)", text: $sku)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                }
                if let error {
                    Text(error).foregroundStyle(.red)
                }
                Button {
                    Task { await create() }
                } label: {
                    if loading {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text("Anlegen").frame(maxWidth: .infinity).bold()
                    }
                }
                .disabled(loading || name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .navigationTitle("Neuer Artikel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
    }

    private func create() async {
        error = nil
        loading = true
        defer { loading = false }
        do {
            let item = try await api.createItem(ItemCreateRequest(
                name: name.trimmingCharacters(in: .whitespaces),
                sku: sku.trimmingCharacters(in: .whitespaces).isEmpty ? nil : sku,
                barcode: barcode
            ))
            onCreated(item)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
