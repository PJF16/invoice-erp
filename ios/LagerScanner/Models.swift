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

enum MovementType: String, Codable, CaseIterable {
    case IN, OUT

    var label: String {
        switch self {
        case .IN: return "Einbuchen"
        case .OUT: return "Ausbuchen"
        }
    }
}

struct MovementRequest: Codable {
    let itemId: String
    let warehouseId: String
    let type: String
    let quantity: Int
    let supplier: String?
    let note: String?
}

struct APIErrorResponse: Codable {
    let error: String
}
