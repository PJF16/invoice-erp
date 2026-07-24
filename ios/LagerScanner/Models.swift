import Foundation

struct StockEntry: Codable, Identifiable {
    let quantity: Int
    let warehouse: Warehouse?
    let warehouseId: String

    var id: String { warehouseId }
}

struct Item: Codable, Identifiable {
    let id: String
    let name: String
    let sku: String?
    let barcode: String?
    let stocks: [StockEntry]?

    var totalQuantity: Int {
        stocks?.reduce(0) { $0 + $1.quantity } ?? 0
    }
}

struct Warehouse: Codable, Identifiable, Hashable {
    let id: String
    let name: String
}

struct CustomerSummary: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let customerNumber: String?
}

enum MovementType: String, Codable, CaseIterable {
    case IN, OUT

    var label: String {
        switch self {
        case .IN: return "Einbuchen"
        case .OUT: return "Ausbuchen"
        }
    }
}

struct ItemCreateRequest: Codable {
    let name: String
    let sku: String?
    let barcode: String?
}

struct MovementRequest: Codable {
    let itemId: String
    let warehouseId: String
    let type: String
    let quantity: Int
    let customerId: String?
    let supplier: String?
    let note: String?
}

struct DeliveryNoteLineRequest: Codable {
    let itemId: String
    let warehouseId: String
    let quantity: Int
}

struct DeliveryNoteRequest: Codable {
    let customerId: String
    let notes: String?
    let lines: [DeliveryNoteLineRequest]
}

struct DeliveryNoteResponse: Codable, Identifiable {
    let id: String
    let number: String
}

struct APIErrorResponse: Codable {
    let error: String
}
