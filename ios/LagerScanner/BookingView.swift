import SwiftUI

struct BookingView: View {
    @EnvironmentObject private var api: APIClient
    @Environment(\.dismiss) private var dismiss

    let item: Item

    @State private var type: MovementType = .IN
    @State private var quantity = 1
    @State private var warehouses: [Warehouse] = []
    @State private var selectedWarehouse: Warehouse?
    @State private var customers: [CustomerSummary] = []
    @State private var selectedCustomer: CustomerSummary?
    @State private var showCustomerPicker = false
    @State private var supplier = ""
    @State private var supplierSuggestions: [String] = []
    @State private var note = ""
    @State private var error: String?
    @State private var loading = false
    @State private var success = false

    private var stockInSelectedWarehouse: Int? {
        guard let selectedWarehouse else { return nil }
        return item.stocks?.first { $0.warehouseId == selectedWarehouse.id }?.quantity ?? 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Artikel", value: item.name)
                    if let sku = item.sku {
                        LabeledContent("SKU", value: sku)
                    }
                    LabeledContent("Gesamtbestand", value: "\(item.totalQuantity)")
                }

                Section {
                    Picker("Aktion", selection: $type) {
                        ForEach(MovementType.allCases, id: \.self) {
                            Text($0.label).tag($0)
                        }
                    }
                    .pickerStyle(.segmented)

                    Picker("Lager", selection: $selectedWarehouse) {
                        ForEach(warehouses) { warehouse in
                            Text(warehouse.name).tag(Optional(warehouse))
                        }
                    }
                    if let stock = stockInSelectedWarehouse {
                        LabeledContent("Bestand in diesem Lager", value: "\(stock)")
                    }

                    Stepper(value: $quantity, in: 1...9999) {
                        HStack {
                            Text("Menge")
                            Spacer()
                            Text("\(quantity)").bold()
                        }
                    }
                }

                if type == .IN {
                    Section("Lieferant (optional)") {
                        TextField("z.B. Ingram Micro", text: $supplier)
                            .autocorrectionDisabled()
                        if !supplierSuggestions.isEmpty && supplier.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack {
                                    ForEach(supplierSuggestions, id: \.self) { name in
                                        Button(name) { supplier = name }
                                            .buttonStyle(.bordered)
                                            .font(.footnote)
                                    }
                                }
                            }
                        }
                    }
                }

                if type == .OUT {
                    Section("Kunde (optional)") {
                        Button {
                            showCustomerPicker = true
                        } label: {
                            HStack {
                                Text("Kunde")
                                Spacer()
                                Text(selectedCustomer.map { customer in
                                    customer.customerNumber.map { "\($0) · \(customer.name)" } ?? customer.name
                                } ?? "Kein Kunde")
                                .foregroundStyle(.secondary)
                            }
                        }
                        .foregroundStyle(.primary)
                        Text("Mit Kunde wird die Ausgabe als ausstehende Übergabe vorgemerkt.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Notiz (optional)") {
                    TextField("Notiz", text: $note)
                }

                if let error {
                    Text(error).foregroundStyle(.red)
                }

                Button {
                    Task { await book() }
                } label: {
                    if loading {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text(type.label)
                            .frame(maxWidth: .infinity)
                            .bold()
                    }
                }
                .listRowBackground(type == .IN ? Color.green : Color.red)
                .foregroundStyle(.white)
                .disabled(loading || selectedWarehouse == nil)
            }
            .navigationTitle("Buchung")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Abbrechen") { dismiss() }
                }
            }
            .task { await load() }
            .sheet(isPresented: $showCustomerPicker) {
                CustomerSelectionView(
                    customers: customers,
                    selectedId: selectedCustomer?.id ?? "",
                    allowsNone: true,
                    onSelect: { customer in
                        selectedCustomer = customer
                        showCustomerPicker = false
                    },
                    onClear: {
                        selectedCustomer = nil
                        showCustomerPicker = false
                    }
                )
            }
            .sensoryFeedback(.success, trigger: success)
        }
    }

    private func load() async {
        do {
            warehouses = try await api.warehouses()
            selectedWarehouse = warehouses.first
            supplierSuggestions = (try? await api.suppliers()) ?? []
            customers = (try? await api.movementCustomers()) ?? []
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func book() async {
        guard let selectedWarehouse else { return }
        error = nil
        loading = true
        defer { loading = false }
        do {
            try await api.bookMovement(MovementRequest(
                itemId: item.id,
                warehouseId: selectedWarehouse.id,
                type: type.rawValue,
                quantity: quantity,
                customerId: type == .OUT ? selectedCustomer?.id : nil,
                supplier: type == .IN && !supplier.isEmpty ? supplier : nil,
                note: note.isEmpty ? nil : note
            ))
            success = true
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
