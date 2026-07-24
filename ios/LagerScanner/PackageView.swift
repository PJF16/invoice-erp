import SwiftUI

private struct PackageItem: Identifiable {
    let item: Item
    var quantity: Int
    var id: String { item.id }
}

struct PackageView: View {
    @EnvironmentObject private var api: APIClient

    @State private var warehouses: [Warehouse] = []
    @State private var selectedWarehouseId = ""
    @State private var customers: [CustomerSummary] = []
    @State private var selectedCustomerId = ""
    @State private var packageItems: [PackageItem] = []
    @State private var manualBarcode = ""
    @State private var notes = ""
    @State private var loading = false
    @State private var lookingUp = false
    @State private var error: String?
    @State private var successNumber: String?
    @State private var showCustomerPicker = false
    @State private var scanFeedback = 0

    private var selectedCustomer: CustomerSummary? {
        customers.first { $0.id == selectedCustomerId }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                VStack(spacing: 10) {
                    Button {
                        showCustomerPicker = true
                    } label: {
                        HStack {
                            Image(systemName: "person.crop.circle")
                            Text(selectedCustomer.map(customerLabel) ?? "Kunde auswählen")
                                .foregroundStyle(selectedCustomer == nil ? .secondary : .primary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(12)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)

                    Picker("Lager", selection: $selectedWarehouseId) {
                        Text("Lager auswählen").tag("")
                        ForEach(warehouses) { warehouse in
                            Text(warehouse.name).tag(warehouse.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal)
                .padding(.top, 8)

                ZStack {
                    BarcodeScannerView { code in
                        Task { await addBarcode(code) }
                    }
                    VStack {
                        Spacer()
                        Text("Artikel für das Paket scannen")
                            .font(.footnote)
                            .padding(8)
                            .background(.black.opacity(0.6))
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                            .padding(.bottom, 10)
                    }
                }
                .frame(height: 210)
                .background(.black)

                HStack {
                    TextField("Barcode manuell eingeben", text: $manualBarcode)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.asciiCapable)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onSubmit { Task { await addBarcode(manualBarcode) } }
                    Button("Hinzufügen") {
                        Task { await addBarcode(manualBarcode) }
                    }
                    .disabled(manualBarcode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || lookingUp)
                }
                .padding()

                if packageItems.isEmpty {
                    ContentUnavailableView(
                        "Paket ist leer",
                        systemImage: "shippingbox",
                        description: Text("Scanne mehrere Artikel. Wiederholtes Scannen erhöht die Menge.")
                    )
                    .frame(maxHeight: .infinity)
                } else {
                    List {
                        ForEach($packageItems) { $entry in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(entry.item.name).font(.headline)
                                        if let sku = entry.item.sku {
                                            Text(sku).font(.caption).foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                    Button(role: .destructive) {
                                        packageItems.removeAll { $0.id == entry.id }
                                    } label: {
                                        Image(systemName: "trash")
                                    }
                                    .buttonStyle(.borderless)
                                }
                                Stepper(value: $entry.quantity, in: 1...9999) {
                                    HStack {
                                        Text("Menge")
                                        Spacer()
                                        Text("\(entry.quantity)").bold()
                                    }
                                }
                                let stock = stockFor(entry.item)
                                Text("Bestand im gewählten Lager: \(stock)")
                                    .font(.caption)
                                    .foregroundStyle(entry.quantity > stock ? .red : .secondary)
                            }
                            .padding(.vertical, 3)
                        }

                        Section("Notiz (optional)") {
                            TextField("Notiz zum Lieferschein", text: $notes, axis: .vertical)
                                .lineLimit(2...4)
                        }
                    }
                    .listStyle(.plain)
                }

                Button {
                    Task { await createDeliveryNote() }
                } label: {
                    if loading {
                        ProgressView().tint(.white).frame(maxWidth: .infinity)
                    } else {
                        Label("Lieferschein erstellen & ausbuchen", systemImage: "doc.text")
                            .frame(maxWidth: .infinity)
                            .bold()
                    }
                }
                .buttonStyle(.borderedProminent)
                .padding()
                .disabled(loading || packageItems.isEmpty || selectedCustomer == nil || selectedWarehouseId.isEmpty)
            }
            .navigationTitle("Paket")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Abmelden") { Task { await api.logout() } }
                }
            }
            .task { await load() }
            .sheet(isPresented: $showCustomerPicker) {
                CustomerSelectionView(
                    customers: customers,
                    selectedId: selectedCustomerId,
                    onSelect: { customer in
                        selectedCustomerId = customer.id
                        showCustomerPicker = false
                    }
                )
            }
            .alert("Fehler", isPresented: .init(get: { error != nil }, set: { if !$0 { error = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error ?? "")
            }
            .alert("Lieferschein erstellt", isPresented: .init(get: { successNumber != nil }, set: { if !$0 { successNumber = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Lieferschein \(successNumber ?? "") wurde erstellt und alle Artikel wurden ausgebucht.")
            }
            .sensoryFeedback(.success, trigger: scanFeedback)
        }
    }

    private func customerLabel(_ customer: CustomerSummary) -> String {
        customer.customerNumber.map { "\($0) · \(customer.name)" } ?? customer.name
    }

    private func stockFor(_ item: Item) -> Int {
        item.stocks?.first { $0.warehouseId == selectedWarehouseId }?.quantity ?? 0
    }

    private func load() async {
        do {
            async let loadedWarehouses = api.warehouses()
            async let loadedCustomers = api.movementCustomers()
            warehouses = try await loadedWarehouses
            customers = try await loadedCustomers
            if selectedWarehouseId.isEmpty {
                selectedWarehouseId = warehouses.first?.id ?? ""
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func addBarcode(_ code: String) async {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !lookingUp else { return }
        lookingUp = true
        defer { lookingUp = false }
        do {
            let item = try await api.itemByBarcode(trimmed)
            if let index = packageItems.firstIndex(where: { $0.item.id == item.id }) {
                packageItems[index].quantity += 1
            } else {
                packageItems.append(PackageItem(item: item, quantity: 1))
            }
            manualBarcode = ""
            scanFeedback += 1
        } catch APIClient.APIError.notFound {
            error = "Kein Artikel mit Barcode „\(trimmed)“ gefunden."
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func createDeliveryNote() async {
        guard let customer = selectedCustomer, !selectedWarehouseId.isEmpty, !packageItems.isEmpty else { return }
        let insufficient = packageItems.first { $0.quantity > stockFor($0.item) }
        if let insufficient {
            error = "Für „\(insufficient.item.name)“ ist im gewählten Lager nicht genügend Bestand vorhanden."
            return
        }
        loading = true
        defer { loading = false }
        do {
            let response = try await api.createDeliveryNote(DeliveryNoteRequest(
                customerId: customer.id,
                notes: notes.isEmpty ? nil : notes,
                lines: packageItems.map {
                    DeliveryNoteLineRequest(itemId: $0.item.id, warehouseId: selectedWarehouseId, quantity: $0.quantity)
                }
            ))
            packageItems = []
            notes = ""
            successNumber = response.number
        } catch {
            self.error = error.localizedDescription
        }
    }
}
