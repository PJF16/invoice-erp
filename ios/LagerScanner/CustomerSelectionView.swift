import SwiftUI

struct CustomerSelectionView: View {
    @Environment(\.dismiss) private var dismiss
    let customers: [CustomerSummary]
    let selectedId: String
    var allowsNone = false
    let onSelect: (CustomerSummary) -> Void
    var onClear: (() -> Void)?
    @State private var query = ""

    private var filteredCustomers: [CustomerSummary] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return customers }
        return customers.filter {
            $0.name.lowercased().contains(normalized) ||
            ($0.customerNumber?.lowercased().contains(normalized) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if allowsNone && query.isEmpty {
                    Button {
                        onClear?()
                        dismiss()
                    } label: {
                        HStack {
                            Text("Kein Kunde").foregroundStyle(.secondary)
                            Spacer()
                            if selectedId.isEmpty {
                                Image(systemName: "checkmark").foregroundStyle(.blue)
                            }
                        }
                    }
                }
                ForEach(filteredCustomers) { customer in
                    Button {
                        onSelect(customer)
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(customer.name)
                                if let number = customer.customerNumber {
                                    Text("Kundennummer \(number)").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if customer.id == selectedId {
                                Image(systemName: "checkmark").foregroundStyle(.blue)
                            }
                        }
                    }
                    .foregroundStyle(.primary)
                }
            }
            .searchable(text: $query, prompt: "Name oder Kundennummer")
            .navigationTitle("Kunde auswählen")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
    }
}
