import { db, pool } from "../db";
import { 
  inventoryCategories, 
  inventoryItems, 
  inventorySuppliers,
  inventoryPurchaseOrders,
  inventoryPurchaseOrderItems,
  inventoryBatches,
  inventorySales,
  inventorySaleItems,
  inventoryStockMovements,
  inventoryStockAlerts,
  inventoryTaxRates,
  insuranceProviders,
  inventorySalePayments,
  inventoryReturns,
  inventoryReturnItems,
  inventoryReturnApprovals,
  inventoryStockAdjustments,
  inventoryCreditNotes,
  type InsertInventoryCategory,
  type InsertInventoryItem,
  type InsertInventorySupplier,
  type InsertInventoryPurchaseOrder,
  type InsertInventoryPurchaseOrderItem,
  type InsertInventoryBatch,
  type InsertInventorySale,
  type InsertInventorySaleItem,
  type InsertInventoryStockMovement,
  type InsertInventoryStockAlert,
  type InsertInventoryTaxRate,
  type InsertInsuranceProvider,
  type InsertInventorySalePayment,
  type InsertInventoryReturn,
  type InsertInventoryReturnItem,
  type InsertInventoryReturnApproval,
  type InsertInventoryStockAdjustment,
  type InsertInventoryCreditNote
} from "@shared/schema";
import { eq, and, desc, asc, sql, sum, gte, lte, gt, isNull, isNotNull, or } from "drizzle-orm";
import { emailService } from "../services/email";

/**
 * Comprehensive Inventory Management Service
 * Handles all inventory operations including stock management, purchase orders, sales, and alerts
 */
export class InventoryService {
  
  // ====== CATEGORY MANAGEMENT ======
  
  async getCategories(organizationId: number) {
    return await db
      .select()
      .from(inventoryCategories)
      .where(and(
        eq(inventoryCategories.organizationId, organizationId),
        eq(inventoryCategories.isActive, true)
      ))
      .orderBy(inventoryCategories.name);
  }

  async createCategory(categoryData: InsertInventoryCategory) {
    const [category] = await db
      .insert(inventoryCategories)
      .values(categoryData)
      .returning();
    
    console.log(`[INVENTORY] Created category: ${category.name} for organization ${categoryData.organizationId}`);
    return category;
  }

  async updateCategory(id: number, organizationId: number, updates: Partial<InsertInventoryCategory>) {
    const [category] = await db
      .update(inventoryCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(inventoryCategories.id, id),
        eq(inventoryCategories.organizationId, organizationId)
      ))
      .returning();
    
    return category;
  }

  // ====== ITEM MANAGEMENT ======
  
  async getItems(organizationId: number, filters?: {
    categoryId?: number;
    lowStock?: boolean;
    search?: string;
    limit?: number;
  }) {
    const conditions = [
      eq(inventoryItems.organizationId, organizationId),
      eq(inventoryItems.isActive, true)
    ];

    if (filters?.categoryId) {
      conditions.push(eq(inventoryItems.categoryId, filters.categoryId));
    }

    if (filters?.lowStock) {
      conditions.push(sql`${inventoryItems.currentStock} <= ${inventoryItems.minimumStock}`);
    }

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(sql`
        LOWER(${inventoryItems.name}) LIKE LOWER(${searchTerm}) OR 
        LOWER(${inventoryItems.brandName}) LIKE LOWER(${searchTerm}) OR 
        LOWER(${inventoryItems.sku}) LIKE LOWER(${searchTerm}) OR
        LOWER(${inventoryItems.barcode}) LIKE LOWER(${searchTerm})
      `);
    }

    let query = db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        description: inventoryItems.description,
        sku: inventoryItems.sku,
        barcode: inventoryItems.barcode,
        brandName: inventoryItems.brandName,
        manufacturer: inventoryItems.manufacturer,
        unitOfMeasurement: inventoryItems.unitOfMeasurement,
        purchasePrice: inventoryItems.purchasePrice,
        salePrice: inventoryItems.salePrice,
        mrp: inventoryItems.mrp,
        currentStock: inventoryItems.currentStock,
        minimumStock: inventoryItems.minimumStock,
        reorderPoint: inventoryItems.reorderPoint,
        prescriptionRequired: inventoryItems.prescriptionRequired,
        isActive: inventoryItems.isActive,
        categoryName: inventoryCategories.name,
        stockValue: sql<number>`${inventoryItems.currentStock} * ${inventoryItems.purchasePrice}`,
        isLowStock: sql<boolean>`${inventoryItems.currentStock} <= ${inventoryItems.minimumStock}`,
        batchStock: sql<number>`COALESCE((SELECT SUM(remaining_quantity) FROM inventory_batches WHERE item_id = ${inventoryItems.id} AND organization_id = ${inventoryItems.organizationId} AND status = 'active' AND is_expired = false AND remaining_quantity > 0 AND (expiry_date IS NULL OR expiry_date > NOW())), 0)`,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt
      })
      .from(inventoryItems)
      .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
      .where(and(...conditions))
      .orderBy(inventoryItems.name);

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
  }

  async getItem(id: number, organizationId: number) {
    const [item] = await db
      .select({
        id: inventoryItems.id,
        organizationId: inventoryItems.organizationId,
        categoryId: inventoryItems.categoryId,
        name: inventoryItems.name,
        description: inventoryItems.description,
        sku: inventoryItems.sku,
        barcode: inventoryItems.barcode,
        genericName: inventoryItems.genericName,
        brandName: inventoryItems.brandName,
        manufacturer: inventoryItems.manufacturer,
        unitOfMeasurement: inventoryItems.unitOfMeasurement,
        packSize: inventoryItems.packSize,
        purchasePrice: inventoryItems.purchasePrice,
        salePrice: inventoryItems.salePrice,
        mrp: inventoryItems.mrp,
        taxRate: inventoryItems.taxRate,
        currentStock: inventoryItems.currentStock,
        minimumStock: inventoryItems.minimumStock,
        maximumStock: inventoryItems.maximumStock,
        reorderPoint: inventoryItems.reorderPoint,
        expiryTracking: inventoryItems.expiryTracking,
        batchTracking: inventoryItems.batchTracking,
        prescriptionRequired: inventoryItems.prescriptionRequired,
        storageConditions: inventoryItems.storageConditions,
        sideEffects: inventoryItems.sideEffects,
        contraindications: inventoryItems.contraindications,
        dosageInstructions: inventoryItems.dosageInstructions,
        isActive: inventoryItems.isActive,
        isDiscontinued: inventoryItems.isDiscontinued,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        categoryName: inventoryCategories.name,
        stockValue: sql<number>`${inventoryItems.currentStock} * ${inventoryItems.purchasePrice}`,
        isLowStock: sql<boolean>`${inventoryItems.currentStock} <= ${inventoryItems.minimumStock}`
      })
      .from(inventoryItems)
      .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
      .where(and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.organizationId, organizationId)
      ));

    return item;
  }

  async createItem(itemData: InsertInventoryItem) {
    const [item] = await db
      .insert(inventoryItems)
      .values(itemData)
      .returning();
    
    console.log(`[INVENTORY] Created item: ${item.name} (SKU: ${item.sku}) for organization ${itemData.organizationId}`);
    
    // Check if stock is low and create alert
    if (item.currentStock <= item.minimumStock) {
      await this.createStockAlert({
        organizationId: item.organizationId,
        itemId: item.id,
        alertType: 'low_stock',
        thresholdValue: item.minimumStock,
        currentValue: item.currentStock,
        status: 'active',
        message: `Stock level for ${item.name} is below minimum threshold (${item.currentStock}/${item.minimumStock})`
      });
    }
    
    return item;
  }

  async updateItem(id: number, organizationId: number, updates: Partial<InsertInventoryItem>) {
    const [item] = await db
      .update(inventoryItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.organizationId, organizationId)
      ))
      .returning();
    
    // Check for low stock after update
    if (item && updates.currentStock !== undefined && item.currentStock <= item.minimumStock) {
      await this.createStockAlert({
        organizationId: item.organizationId,
        itemId: item.id,
        alertType: 'low_stock',
        thresholdValue: item.minimumStock,
        currentValue: item.currentStock,
        status: 'active',
        message: `Stock level for ${item.name} is below minimum threshold (${item.currentStock}/${item.minimumStock})`
      });
    }
    
    return item;
  }

  async deleteItem(id: number, organizationId: number) {
    console.log(`[INVENTORY] Attempting to delete item ${id} for organization ${organizationId}`);
    
    // First check if item exists
    const existingItem = await this.getItem(id, organizationId);
    if (!existingItem) {
      console.log(`[INVENTORY] Item ${id} not found`);
      return false;
    }

    // Delete the item
    const result = await db
      .delete(inventoryItems)
      .where(and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.organizationId, organizationId)
      ))
      .returning({ id: inventoryItems.id });

    if (result.length > 0) {
      console.log(`[INVENTORY] Successfully deleted item ${id} (${existingItem.name})`);
      return true;
    } else {
      console.log(`[INVENTORY] Failed to delete item ${id}`);
      return false;
    }
  }

  // ====== SUPPLIER MANAGEMENT ======
  
  async getSuppliers(organizationId: number) {
    return await db
      .select()
      .from(inventorySuppliers)
      .where(and(
        eq(inventorySuppliers.organizationId, organizationId),
        eq(inventorySuppliers.isActive, true)
      ))
      .orderBy(inventorySuppliers.name);
  }

  async createSupplier(supplierData: InsertInventorySupplier) {
    const [supplier] = await db
      .insert(inventorySuppliers)
      .values(supplierData)
      .returning();
    
    console.log(`[INVENTORY] Created supplier: ${supplier.name} for organization ${supplierData.organizationId}`);
    return supplier;
  }

  async updateSupplier(id: number, organizationId: number, updates: Partial<InsertInventorySupplier>) {
    const [supplier] = await db
      .update(inventorySuppliers)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(inventorySuppliers.id, id),
        eq(inventorySuppliers.organizationId, organizationId)
      ))
      .returning();
    
    return supplier;
  }

  // ====== PURCHASE ORDER MANAGEMENT ======
  
  async createPurchaseOrder(orderData: InsertInventoryPurchaseOrder, items: InsertInventoryPurchaseOrderItem[]) {
    return await db.transaction(async (tx) => {
      // Create purchase order
      const [purchaseOrder] = await tx
        .insert(inventoryPurchaseOrders)
        .values(orderData)
        .returning();

      // Add items to purchase order
      const orderItems = await tx
        .insert(inventoryPurchaseOrderItems)
        .values(items.map(item => ({
          ...item,
          purchaseOrderId: purchaseOrder.id,
          organizationId: orderData.organizationId
        })))
        .returning();

      console.log(`[INVENTORY] Created purchase order ${purchaseOrder.poNumber} with ${orderItems.length} items`);
      
      return { purchaseOrder, items: orderItems };
    });
  }

  async getPurchaseOrders(organizationId: number, status?: string) {
    const conditions = [eq(inventoryPurchaseOrders.organizationId, organizationId)];
    
    if (status) {
      conditions.push(eq(inventoryPurchaseOrders.status, status));
    }

    return await db
      .select({
        id: inventoryPurchaseOrders.id,
        poNumber: inventoryPurchaseOrders.poNumber,
        orderDate: inventoryPurchaseOrders.orderDate,
        expectedDeliveryDate: inventoryPurchaseOrders.expectedDeliveryDate,
        status: inventoryPurchaseOrders.status,
        totalAmount: inventoryPurchaseOrders.totalAmount,
        taxAmount: inventoryPurchaseOrders.taxAmount,
        emailSent: inventoryPurchaseOrders.emailSent,
        emailSentAt: inventoryPurchaseOrders.emailSentAt,
        supplierName: inventorySuppliers.name,
        supplierEmail: inventorySuppliers.email,
        createdAt: inventoryPurchaseOrders.createdAt
      })
      .from(inventoryPurchaseOrders)
      .leftJoin(inventorySuppliers, eq(inventoryPurchaseOrders.supplierId, inventorySuppliers.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryPurchaseOrders.createdAt));
  }

  async getPurchaseOrderItems(purchaseOrderId: number, organizationId: number) {
    return await db
      .select({
        id: inventoryPurchaseOrderItems.id,
        itemId: inventoryPurchaseOrderItems.itemId,
        quantity: inventoryPurchaseOrderItems.quantity,
        unitPrice: inventoryPurchaseOrderItems.unitPrice,
        itemName: inventoryItems.name,
      })
      .from(inventoryPurchaseOrderItems)
      .leftJoin(inventoryItems, eq(inventoryPurchaseOrderItems.itemId, inventoryItems.id))
      .where(and(
        eq(inventoryPurchaseOrderItems.purchaseOrderId, purchaseOrderId),
        eq(inventoryPurchaseOrderItems.organizationId, organizationId)
      ))
      .orderBy(inventoryPurchaseOrderItems.id);
  }

  async getPurchaseOrderById(purchaseOrderId: number, organizationId: number) {
    const [order] = await db
      .select({
        id: inventoryPurchaseOrders.id,
        poNumber: inventoryPurchaseOrders.poNumber,
        orderDate: inventoryPurchaseOrders.orderDate,
        expectedDeliveryDate: inventoryPurchaseOrders.expectedDeliveryDate,
        status: inventoryPurchaseOrders.status,
        totalAmount: inventoryPurchaseOrders.totalAmount,
        taxAmount: inventoryPurchaseOrders.taxAmount,
        discountAmount: inventoryPurchaseOrders.discountAmount,
        notes: inventoryPurchaseOrders.notes,
        supplierName: inventorySuppliers.name,
        supplierEmail: inventorySuppliers.email,
        createdAt: inventoryPurchaseOrders.createdAt,
        updatedAt: inventoryPurchaseOrders.updatedAt,
        emailSent: inventoryPurchaseOrders.emailSent,
        emailSentAt: inventoryPurchaseOrders.emailSentAt,
      })
      .from(inventoryPurchaseOrders)
      .leftJoin(inventorySuppliers, eq(inventoryPurchaseOrders.supplierId, inventorySuppliers.id))
      .where(and(
        eq(inventoryPurchaseOrders.id, purchaseOrderId),
        eq(inventoryPurchaseOrders.organizationId, organizationId)
      ))
      .limit(1);

    if (!order) return null;

    const itemsOrdered = await db
      .select({
        id: inventoryPurchaseOrderItems.id,
        itemId: inventoryPurchaseOrderItems.itemId,
        itemName: inventoryItems.name,
        quantity: inventoryPurchaseOrderItems.quantity,
        unitPrice: inventoryPurchaseOrderItems.unitPrice,
        totalPrice: inventoryPurchaseOrderItems.totalPrice,
      })
      .from(inventoryPurchaseOrderItems)
      .leftJoin(inventoryItems, eq(inventoryPurchaseOrderItems.itemId, inventoryItems.id))
      .where(and(
        eq(inventoryPurchaseOrderItems.purchaseOrderId, purchaseOrderId),
        eq(inventoryPurchaseOrderItems.organizationId, organizationId)
      ))
      .orderBy(inventoryPurchaseOrderItems.id);

    return {
      ...order,
      itemsOrdered,
    };
  }

  async sendPurchaseOrderEmail(purchaseOrderId: number, organizationId: number) {
    const [po] = await db
      .select({
        id: inventoryPurchaseOrders.id,
        poNumber: inventoryPurchaseOrders.poNumber,
        totalAmount: inventoryPurchaseOrders.totalAmount,
        supplierEmail: inventorySuppliers.email,
        supplierName: inventorySuppliers.name
      })
      .from(inventoryPurchaseOrders)
      .leftJoin(inventorySuppliers, eq(inventoryPurchaseOrders.supplierId, inventorySuppliers.id))
      .where(and(
        eq(inventoryPurchaseOrders.id, purchaseOrderId),
        eq(inventoryPurchaseOrders.organizationId, organizationId)
      ));

    if (!po || !po.supplierEmail) {
      throw new Error('Purchase order not found or supplier email missing');
    }

    // Get purchase order items
    const items = await db
      .select({
        itemName: inventoryItems.name,
        quantity: inventoryPurchaseOrderItems.quantity,
        unitPrice: inventoryPurchaseOrderItems.unitPrice,
        totalPrice: inventoryPurchaseOrderItems.totalPrice
      })
      .from(inventoryPurchaseOrderItems)
      .leftJoin(inventoryItems, eq(inventoryPurchaseOrderItems.itemId, inventoryItems.id))
      .where(eq(inventoryPurchaseOrderItems.purchaseOrderId, purchaseOrderId));

    // Send email to Halo Pharmacy
    const subject = `Purchase Order ${po.poNumber} - Healthcare Supplies Request`;
    const message = `
Dear ${po.supplierName || 'Halo Pharmacy Team'},

Please find our purchase order details below:

Purchase Order Number: ${po.poNumber}
Total Amount: £${po.totalAmount}

Items Requested:
${items.map(item => 
  `- ${item.itemName}: ${item.quantity} units @ £${item.unitPrice} each = £${item.totalPrice}`
).join('\n')}

Please confirm receipt and provide expected delivery timeframe.

Best regards,
Cura Healthcare Team
    `.trim();

    try {
      await emailService.sendEmail({
        to: po.supplierEmail,
        subject,
        text: message,
        html: message.replace(/\n/g, '<br>')
      });
      
      // Update purchase order as email sent
      await db
        .update(inventoryPurchaseOrders)
        .set({ 
          emailSent: true, 
          emailSentAt: new Date(),
          status: 'sent' 
        })
        .where(eq(inventoryPurchaseOrders.id, purchaseOrderId));
      
      console.log(`[INVENTORY] Purchase order ${po.poNumber} emailed to ${po.supplierEmail}`);
      return true;
    } catch (error) {
      console.error(`[INVENTORY] Failed to send purchase order email:`, error);
      throw new Error('Failed to send purchase order email');
    }
  }

  async deletePurchaseOrder(purchaseOrderId: number, organizationId: number) {
    return await db.transaction(async (tx) => {
      // Delete purchase order items first
      await tx
        .delete(inventoryPurchaseOrderItems)
        .where(eq(inventoryPurchaseOrderItems.purchaseOrderId, purchaseOrderId));

      // Delete the purchase order
      const [deletedPO] = await tx
        .delete(inventoryPurchaseOrders)
        .where(and(
          eq(inventoryPurchaseOrders.id, purchaseOrderId),
          eq(inventoryPurchaseOrders.organizationId, organizationId)
        ))
        .returning();

      if (!deletedPO) {
        throw new Error('Purchase order not found');
      }

      console.log(`[INVENTORY] Deleted purchase order ${deletedPO.poNumber}`);
      return true;
    });
  }

  // ====== STOCK MANAGEMENT ======
  
  async updateStock(itemId: number, organizationId: number, quantity: number, movementType: string, notes?: string, userId?: number) {
    return await db.transaction(async (tx) => {
      // Get current item
      const [item] = await tx
        .select()
        .from(inventoryItems)
        .where(and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.organizationId, organizationId)
        ));

      if (!item) {
        throw new Error('Item not found');
      }

      const previousStock = item.currentStock;
      const newStock = previousStock + quantity;

      // Update item stock
      await tx
        .update(inventoryItems)
        .set({ 
          currentStock: newStock,
          updatedAt: new Date()
        })
        .where(eq(inventoryItems.id, itemId));

      // Record stock movement
      await tx
        .insert(inventoryStockMovements)
        .values({
          organizationId,
          itemId,
          movementType,
          quantity,
          previousStock,
          newStock,
          unitCost: item.purchasePrice,
          notes,
          createdBy: userId || 1
        });

      // Check for low stock alert
      if (newStock <= item.minimumStock) {
        await this.createStockAlert({
          organizationId,
          itemId,
          alertType: 'low_stock',
          thresholdValue: item.minimumStock,
          currentValue: newStock,
          status: 'active',
          message: `Stock level for ${item.name} is below minimum threshold (${newStock}/${item.minimumStock})`
        });
      }

      console.log(`[INVENTORY] Stock updated for ${item.name}: ${previousStock} → ${newStock} (${quantity > 0 ? '+' : ''}${quantity})`);
      return { previousStock, newStock, item };
    });
  }

  // ====== STOCK ALERTS ======
  
  async createStockAlert(alertData: InsertInventoryStockAlert) {
    // Check if similar alert already exists
    const existingAlert = await db
      .select()
      .from(inventoryStockAlerts)
      .where(and(
        eq(inventoryStockAlerts.organizationId, alertData.organizationId),
        eq(inventoryStockAlerts.itemId, alertData.itemId),
        eq(inventoryStockAlerts.alertType, alertData.alertType),
        eq(inventoryStockAlerts.isResolved, false)
      ));

    if (existingAlert.length > 0) {
      return existingAlert[0]; // Don't create duplicate alerts
    }

    const [alert] = await db
      .insert(inventoryStockAlerts)
      .values(alertData)
      .returning();
    
    console.log(`[INVENTORY] Created stock alert: ${alertData.alertType} for item ${alertData.itemId}`);
    return alert;
  }

  async getStockAlerts(organizationId: number, unreadOnly: boolean = false) {
    const conditions = [eq(inventoryStockAlerts.organizationId, organizationId)];
    
    if (unreadOnly) {
      conditions.push(eq(inventoryStockAlerts.isRead, false));
    }

    return await db
      .select({
        id: inventoryStockAlerts.id,
        alertType: inventoryStockAlerts.alertType,
        message: inventoryStockAlerts.message,
        isRead: inventoryStockAlerts.isRead,
        isResolved: inventoryStockAlerts.isResolved,
        createdAt: inventoryStockAlerts.createdAt,
        itemName: inventoryItems.name,
        itemSku: inventoryItems.sku,
        currentStock: inventoryItems.currentStock,
        minimumStock: inventoryItems.minimumStock
      })
      .from(inventoryStockAlerts)
      .leftJoin(inventoryItems, eq(inventoryStockAlerts.itemId, inventoryItems.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryStockAlerts.createdAt));
  }

  // ====== INVENTORY REPORTS ======
  
  async getInventoryValue(organizationId: number) {
    const result = await db
      .select({
        totalValue: sql<number>`SUM(${inventoryItems.currentStock} * ${inventoryItems.purchasePrice})`,
        totalItems: sql<number>`COUNT(*)`,
        totalStock: sql<number>`SUM(${inventoryItems.currentStock})`,
        lowStockItems: sql<number>`COUNT(CASE WHEN ${inventoryItems.currentStock} <= ${inventoryItems.minimumStock} THEN 1 END)`
      })
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.organizationId, organizationId),
        eq(inventoryItems.isActive, true)
      ));

    return result[0];
  }

  async getLowStockItems(organizationId: number) {
    return await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        sku: inventoryItems.sku,
        currentStock: inventoryItems.currentStock,
        minimumStock: inventoryItems.minimumStock,
        reorderPoint: inventoryItems.reorderPoint,
        categoryName: inventoryCategories.name
      })
      .from(inventoryItems)
      .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
      .where(and(
        eq(inventoryItems.organizationId, organizationId),
        eq(inventoryItems.isActive, true),
        sql`${inventoryItems.currentStock} <= ${inventoryItems.minimumStock}`
      ))
      .orderBy(inventoryItems.name);
  }

  async getStockMovements(organizationId: number, itemId?: number, limit: number = 50) {
    const conditions = [eq(inventoryStockMovements.organizationId, organizationId)];
    
    if (itemId) {
      conditions.push(eq(inventoryStockMovements.itemId, itemId));
    }

    return await db
      .select({
        id: inventoryStockMovements.id,
        itemName: inventoryItems.name,
        movementType: inventoryStockMovements.movementType,
        quantity: inventoryStockMovements.quantity,
        previousStock: inventoryStockMovements.previousStock,
        newStock: inventoryStockMovements.newStock,
        unitCost: inventoryStockMovements.unitCost,
        notes: inventoryStockMovements.notes,
        createdAt: inventoryStockMovements.createdAt
      })
      .from(inventoryStockMovements)
      .leftJoin(inventoryItems, eq(inventoryStockMovements.itemId, inventoryItems.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryStockMovements.createdAt))
      .limit(limit);
  }

  // ====== BARCODE & SKU GENERATION ======
  
  generateSKU(categoryName: string, itemName: string): string {
    const categoryCode = categoryName.substring(0, 3).toUpperCase();
    const itemCode = itemName.replace(/\s+/g, '').substring(0, 6).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    return `${categoryCode}-${itemCode}-${timestamp}`;
  }

  generateBarcode(): string {
    // Generate a simple 12-digit barcode
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  }

  // ====== GOODS RECEIPTS ======
  
  async getGoodsReceipts(organizationId: number) {
    // Get all stock movements that represent goods receipts
    const stockMovements = await db
      .select({
        id: inventoryStockMovements.id,
        receiptNumber: sql<string>`CONCAT('GR-', ${inventoryStockMovements.id})`,
        purchaseOrderId: inventoryStockMovements.referenceId,
        receivedDate: inventoryStockMovements.createdAt,
        receivedBy: inventoryStockMovements.createdBy,
        notes: inventoryStockMovements.notes,
        itemId: inventoryStockMovements.itemId,
        itemName: inventoryItems.name,
        quantityReceived: inventoryStockMovements.quantity,
        unitCost: inventoryStockMovements.unitCost,
        batchNumber: inventoryBatches.batchNumber,
        expiryDate: inventoryBatches.expiryDate,
        // Purchase Order details
        poNumber: inventoryPurchaseOrders.poNumber,
        poStatus: inventoryPurchaseOrders.status,
        poOrderDate: inventoryPurchaseOrders.orderDate,
        poExpectedDeliveryDate: inventoryPurchaseOrders.expectedDeliveryDate,
        poTotalAmount: inventoryPurchaseOrders.totalAmount,
        poTaxAmount: inventoryPurchaseOrders.taxAmount,
        poDiscountAmount: inventoryPurchaseOrders.discountAmount,
        poNotes: inventoryPurchaseOrders.notes,
        // Supplier details
        supplierId: inventorySuppliers.id,
        supplierName: inventorySuppliers.name,
        supplierEmail: inventorySuppliers.email,
        supplierPhone: inventorySuppliers.phone,
        supplierAddress: inventorySuppliers.address,
      })
      .from(inventoryStockMovements)
      .innerJoin(inventoryPurchaseOrders, eq(inventoryStockMovements.referenceId, inventoryPurchaseOrders.id))
      .leftJoin(inventoryItems, eq(inventoryStockMovements.itemId, inventoryItems.id))
      .leftJoin(inventoryBatches, eq(inventoryStockMovements.batchId, inventoryBatches.id))
      .leftJoin(inventorySuppliers, eq(inventoryPurchaseOrders.supplierId, inventorySuppliers.id))
      .where(and(
        eq(inventoryStockMovements.organizationId, organizationId),
        eq(inventoryStockMovements.movementType, 'purchase')
      ))
      .orderBy(desc(inventoryStockMovements.createdAt));

    // Group by receipt ID (stock movement ID) and aggregate data
    const receiptMap = new Map<number, any>();
    
    for (const movement of stockMovements) {
      const receiptId = movement.id;
      
      if (!receiptMap.has(receiptId)) {
        receiptMap.set(receiptId, {
          id: receiptId,
          receiptNumber: movement.receiptNumber,
          purchaseOrderId: movement.purchaseOrderId,
          poNumber: movement.poNumber || null,
          poStatus: movement.poStatus || null,
          poOrderDate: movement.poOrderDate || null,
          poExpectedDeliveryDate: movement.poExpectedDeliveryDate || null,
          poTotalAmount: movement.poTotalAmount ? parseFloat(String(movement.poTotalAmount)) : null,
          poTaxAmount: movement.poTaxAmount ? parseFloat(String(movement.poTaxAmount)) : null,
          poDiscountAmount: movement.poDiscountAmount ? parseFloat(String(movement.poDiscountAmount)) : null,
          poNotes: movement.poNotes || null,
          supplierId: movement.supplierId || null,
          supplierName: movement.supplierName || null,
          supplierEmail: movement.supplierEmail || null,
          supplierPhone: movement.supplierPhone || null,
          supplierAddress: movement.supplierAddress || null,
          receivedDate: movement.receivedDate,
          receivedBy: movement.receivedBy,
          notes: movement.notes || null,
          items: [],
          totalAmount: 0,
        });
      }
      
      const receipt = receiptMap.get(receiptId)!;
      
      // Add item to receipt
      if (movement.itemId) {
        receipt.items.push({
          itemId: movement.itemId,
          itemName: movement.itemName || 'Unknown Item',
          quantityReceived: movement.quantityReceived || 0,
          unitCost: movement.unitCost ? parseFloat(String(movement.unitCost)) : 0,
          batchNumber: movement.batchNumber || null,
          expiryDate: movement.expiryDate || null,
        });
        
        // Calculate total amount from items
        const itemTotal = (movement.quantityReceived || 0) * (movement.unitCost ? parseFloat(String(movement.unitCost)) : 0);
        receipt.totalAmount += itemTotal;
      }
    }
    
    // If purchase order total amount exists, use it; otherwise use calculated total
    const receipts = Array.from(receiptMap.values()).map(receipt => ({
      ...receipt,
      totalAmount: receipt.poTotalAmount !== null && receipt.poTotalAmount > 0 
        ? receipt.poTotalAmount 
        : receipt.totalAmount,
    }));

    return receipts;
  }

  async getGoodsReceiptById(receiptId: number, organizationId: number) {
    try {
      console.log(`[INVENTORY] Starting getGoodsReceiptById for receiptId: ${receiptId}, organizationId: ${organizationId}`);
      
      // First, get the movement to find the purchase order ID and receipt details
      const movementResult = await db
      .select({
        id: inventoryStockMovements.id,
        receiptNumber: sql<string>`CONCAT('GR-', ${inventoryStockMovements.id})`,
        purchaseOrderId: inventoryStockMovements.referenceId,
        poNumber: inventoryPurchaseOrders.poNumber,
        supplierName: inventorySuppliers.name,
        receivedDate: inventoryStockMovements.createdAt,
        notes: inventoryStockMovements.notes,
          referenceId: inventoryStockMovements.referenceId,
      })
      .from(inventoryStockMovements)
      .leftJoin(inventoryPurchaseOrders, eq(inventoryStockMovements.referenceId, inventoryPurchaseOrders.id))
      .leftJoin(inventorySuppliers, eq(inventoryPurchaseOrders.supplierId, inventorySuppliers.id))
      .where(and(
        eq(inventoryStockMovements.organizationId, organizationId),
        eq(inventoryStockMovements.id, receiptId),
        eq(inventoryStockMovements.movementType, 'purchase')
      ))
      .limit(1);

      // Safely log movement result
      try {
        console.log(`[INVENTORY] Movement query result length:`, movementResult?.length || 0);
        if (movementResult && movementResult.length > 0) {
          const firstMovement = movementResult[0];
          console.log(`[INVENTORY] First movement raw data:`, {
            id: firstMovement?.id,
            receiptNumber: firstMovement?.receiptNumber,
            purchaseOrderId: firstMovement?.purchaseOrderId,
            poNumber: firstMovement?.poNumber,
            supplierName: firstMovement?.supplierName,
            receivedDate: firstMovement?.receivedDate,
            notes: firstMovement?.notes,
            referenceId: firstMovement?.referenceId
          });
          console.log(`[INVENTORY] First movement types:`, {
            id: typeof firstMovement?.id,
            receiptNumber: typeof firstMovement?.receiptNumber,
            purchaseOrderId: typeof firstMovement?.purchaseOrderId,
            poNumber: typeof firstMovement?.poNumber,
            supplierName: typeof firstMovement?.supplierName,
            receivedDate: typeof firstMovement?.receivedDate,
            notes: typeof firstMovement?.notes,
            referenceId: typeof firstMovement?.referenceId
          });
        }
      } catch (logError: any) {
        console.error(`[INVENTORY] Error logging movement result:`, logError?.message, logError?.stack);
      }
      
      const movement = movementResult?.[0];
      
      if (!movement) {
        console.log(`[INVENTORY] Goods receipt ${receiptId} not found for organization ${organizationId}`);
        return null;
      }
      
      // Validate movement is a proper object
      if (typeof movement !== 'object') {
        console.error(`[INVENTORY] Movement is not an object:`, typeof movement, movement);
        return null;
      }
      
      console.log(`[INVENTORY] Movement object keys:`, Object.keys(movement));
      
      if (!movement.id) {
        console.error(`[INVENTORY] Goods receipt ${receiptId} found but missing ID:`, movement);
        return null;
      }
      
      console.log(`[INVENTORY] Found movement with ID: ${movement.id}, referenceId: ${movement.referenceId}`);

      // Get ALL items for this goods receipt
      // If referenceId exists, get all movements with the same referenceId (same purchase order)
      // Otherwise, just get the single movement
      let items: any[] = [];
      
      // Safely check referenceId
      const movementReferenceId = movement.referenceId != null ? Number(movement.referenceId) : null;
      
      if (movementReferenceId) {
        // Get all items from the same purchase order created on the same day
        let receiptDate: Date;
        try {
          if (movement.receivedDate instanceof Date) {
            receiptDate = movement.receivedDate;
          } else if (movement.receivedDate) {
            receiptDate = new Date(movement.receivedDate);
            if (isNaN(receiptDate.getTime())) {
              throw new Error('Invalid date');
            }
          } else {
            receiptDate = new Date();
          }
        } catch (dateError) {
          console.error(`[INVENTORY] Invalid receipt date, using current date:`, dateError);
          receiptDate = new Date();
        }
        
        const receiptDateStart = new Date(receiptDate);
        receiptDateStart.setHours(0, 0, 0, 0);
        const receiptDateEnd = new Date(receiptDate);
        receiptDateEnd.setHours(23, 59, 59, 999);

        try {
          const itemsResult = await db
      .select({
        id: inventoryStockMovements.id,
        itemId: inventoryStockMovements.itemId,
        itemName: inventoryItems.name,
        batchNumber: inventoryStockMovements.batchNumber,
        expiryDate: inventoryStockMovements.expiryDate,
        quantity: inventoryStockMovements.quantity,
        unitPrice: inventoryStockMovements.unitCost,
        totalPrice: sql<number>`(${inventoryStockMovements.quantity} * ${inventoryStockMovements.unitCost})`,
      })
      .from(inventoryStockMovements)
      .leftJoin(inventoryItems, eq(inventoryStockMovements.itemId, inventoryItems.id))
      .where(and(
        eq(inventoryStockMovements.organizationId, organizationId),
              eq(inventoryStockMovements.referenceId, movementReferenceId),
              eq(inventoryStockMovements.movementType, 'purchase'),
              gte(inventoryStockMovements.createdAt, receiptDateStart),
              lte(inventoryStockMovements.createdAt, receiptDateEnd)
            ));
          items = Array.isArray(itemsResult) ? itemsResult : [];
        } catch (dateError: any) {
          console.error(`[INVENTORY] Error querying items by date, falling back to referenceId only:`, dateError);
          try {
            // Fallback: just get items by referenceId without date filter
            const fallbackResult = await db
              .select({
                id: inventoryStockMovements.id,
                itemId: inventoryStockMovements.itemId,
                itemName: inventoryItems.name,
                batchNumber: inventoryStockMovements.batchNumber,
                expiryDate: inventoryStockMovements.expiryDate,
                quantity: inventoryStockMovements.quantity,
                unitPrice: inventoryStockMovements.unitCost,
                totalPrice: sql<number>`(${inventoryStockMovements.quantity} * ${inventoryStockMovements.unitCost})`,
              })
              .from(inventoryStockMovements)
              .leftJoin(inventoryItems, eq(inventoryStockMovements.itemId, inventoryItems.id))
              .where(and(
                eq(inventoryStockMovements.organizationId, organizationId),
                eq(inventoryStockMovements.referenceId, movementReferenceId),
                eq(inventoryStockMovements.movementType, 'purchase')
              ));
            items = Array.isArray(fallbackResult) ? fallbackResult : [];
          } catch (fallbackError: any) {
            console.error(`[INVENTORY] Error in fallback query:`, fallbackError);
            items = [];
          }
        }
      } else {
        // If no referenceId, just return the single movement as an item
        // Query items directly by receiptId (which is the movement id)
        try {
          // Query with explicit field selection to avoid Drizzle issues
          const itemsResult = await db
            .select({
              id: inventoryStockMovements.id,
              itemId: inventoryStockMovements.itemId,
              itemName: inventoryItems.name,
              batchNumber: inventoryStockMovements.batchNumber,
              expiryDate: inventoryStockMovements.expiryDate,
              quantity: inventoryStockMovements.quantity,
              unitPrice: inventoryStockMovements.unitCost,
              totalPrice: sql<number>`(${inventoryStockMovements.quantity} * ${inventoryStockMovements.unitCost})`,
            })
            .from(inventoryStockMovements)
            .leftJoin(inventoryItems, eq(inventoryStockMovements.itemId, inventoryItems.id))
            .where(and(
              eq(inventoryStockMovements.organizationId, organizationId),
              eq(inventoryStockMovements.id, receiptId),
              eq(inventoryStockMovements.movementType, 'purchase')
            ));
          
          // Ensure result is an array
          items = Array.isArray(itemsResult) ? itemsResult : [];
        } catch (queryError: any) {
          console.error(`[INVENTORY] Error querying items for receipt ${receiptId} without referenceId:`, queryError);
          console.error(`[INVENTORY] Query error message:`, queryError?.message);
          console.error(`[INVENTORY] Query error stack:`, queryError?.stack);
          // Fallback: return empty array if query fails
          items = [];
        }
      }

      // Ensure items is always an array and handle query failures
      let itemsArray: any[] = [];
      try {
        if (items !== undefined && items !== null) {
          itemsArray = Array.isArray(items) ? items : [];
        }
      } catch (itemsError) {
        console.error(`[INVENTORY] Error processing items array:`, itemsError);
        itemsArray = [];
      }
      console.log(`[INVENTORY] Found ${itemsArray.length} items for goods receipt ${receiptId}`);

      // Calculate total amount from all items with null safety
      const totalAmount = itemsArray.reduce((sum, item) => {
        if (!item || typeof item !== 'object') {
          return sum;
        }
        try {
          const itemTotal = typeof item.totalPrice === 'number' 
            ? item.totalPrice 
            : (item.totalPrice !== null && item.totalPrice !== undefined
                ? parseFloat(String(item.totalPrice)) || 0
                : 0);
          return sum + (isNaN(itemTotal) ? 0 : itemTotal);
        } catch (error) {
          console.error(`[INVENTORY] Error calculating item total:`, error, item);
          return sum;
        }
      }, 0);

      console.log(`[INVENTORY] Found goods receipt ${receiptId} with ${itemsArray.length} items, total: ${totalAmount}`);

      // Safely construct the return object with comprehensive null checks
      // Ensure all values are properly serializable
      
      // STEP 1: Safely extract movement properties with null checks
      console.log(`[INVENTORY STEP 1] Checking movement.id:`, movement?.id, typeof movement?.id);
      const movementId = movement?.id != null ? Number(movement.id) : null;
      if (!movementId) {
        console.error(`[INVENTORY STEP 1 ERROR] Movement ID is null/undefined for receipt ${receiptId}`);
        console.error(`[INVENTORY STEP 1 ERROR] Movement object:`, JSON.stringify(movement, null, 2));
        return null;
      }
      console.log(`[INVENTORY STEP 1 SUCCESS] Movement ID: ${movementId}`);

      // STEP 2: Safely handle receiptNumber (from SQL CONCAT)
      console.log(`[INVENTORY STEP 2] Checking movement.receiptNumber:`, movement?.receiptNumber, typeof movement?.receiptNumber);
      let safeReceiptNumber: string;
      try {
        if (movement.receiptNumber != null) {
          console.log(`[INVENTORY STEP 2] receiptNumber exists, converting to string`);
          safeReceiptNumber = String(movement.receiptNumber);
        } else {
          console.log(`[INVENTORY STEP 2] receiptNumber is null, using fallback`);
          safeReceiptNumber = `GR-${movementId}`;
        }
        console.log(`[INVENTORY STEP 2 SUCCESS] safeReceiptNumber: ${safeReceiptNumber}`);
      } catch (error: any) {
        console.error(`[INVENTORY STEP 2 ERROR] Error converting receiptNumber:`, error?.message, error?.stack);
        safeReceiptNumber = `GR-${movementId}`;
      }

      // STEP 3: Safely handle receivedDate
      console.log(`[INVENTORY STEP 3] Checking movement.receivedDate:`, movement?.receivedDate, typeof movement?.receivedDate);
      let validReceivedDate: Date;
      try {
        if (movement.receivedDate) {
          if (movement.receivedDate instanceof Date) {
            console.log(`[INVENTORY STEP 3] receivedDate is Date instance`);
            validReceivedDate = movement.receivedDate;
          } else {
            console.log(`[INVENTORY STEP 3] receivedDate is not Date, converting`);
            validReceivedDate = new Date(movement.receivedDate);
            if (isNaN(validReceivedDate.getTime())) {
              console.error(`[INVENTORY STEP 3] Invalid date, using current date`);
              validReceivedDate = new Date();
            }
          }
        } else {
          console.log(`[INVENTORY STEP 3] receivedDate is null/undefined, using current date`);
          validReceivedDate = new Date();
        }
        console.log(`[INVENTORY STEP 3 SUCCESS] validReceivedDate: ${validReceivedDate.toISOString()}`);
      } catch (error: any) {
        console.error(`[INVENTORY STEP 3 ERROR] Error processing receivedDate:`, error?.message, error?.stack);
        validReceivedDate = new Date();
      }

      // STEP 4: Safely map items array to ensure all properties are serializable
      console.log(`[INVENTORY STEP 4] Processing ${itemsArray.length} items`);
      const safeItemsArray = itemsArray.map((item: any, index: number) => {
        console.log(`[INVENTORY STEP 4] Processing item ${index}:`, item);
        if (!item || typeof item !== 'object') {
          console.error(`[INVENTORY STEP 4 ERROR] Item ${index} is not an object:`, typeof item, item);
          return null;
        }
        try {
          console.log(`[INVENTORY STEP 4] Item ${index} fields:`, {
            id: item.id,
            itemId: item.itemId,
            itemName: item.itemName,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          });
          // Convert all values to plain JavaScript types
          const safeItem = {
            id: item.id != null ? Number(item.id) : null,
            itemId: item.itemId != null ? Number(item.itemId) : null,
            itemName: item.itemName != null ? String(item.itemName) : null,
            batchNumber: item.batchNumber != null ? String(item.batchNumber) : null,
            expiryDate: item.expiryDate != null 
              ? (item.expiryDate instanceof Date 
                  ? item.expiryDate.toISOString() 
                  : String(item.expiryDate))
              : null,
            quantity: item.quantity != null ? Number(item.quantity) : 0,
            unitPrice: item.unitPrice != null ? Number(item.unitPrice) : 0,
            totalPrice: item.totalPrice != null ? Number(item.totalPrice) : 0,
          };
          console.log(`[INVENTORY STEP 4 SUCCESS] Item ${index} mapped successfully`);
          return safeItem;
        } catch (error: any) {
          console.error(`[INVENTORY STEP 4 ERROR] Error mapping item ${index}:`, error?.message, error?.stack);
          console.error(`[INVENTORY STEP 4 ERROR] Item data:`, JSON.stringify(item, null, 2));
          return null;
        }
      }).filter((item: any) => item !== null);
      console.log(`[INVENTORY STEP 4 SUCCESS] Mapped ${safeItemsArray.length} items successfully`);

      // STEP 5: Safely extract all movement properties
      console.log(`[INVENTORY STEP 5] Extracting movement properties`);
      let safePurchaseOrderId: number | null = null;
      let safePoNumber: string | null = null;
      let safeSupplierName: string | null = null;
      let safeNotes: string | null = null;
      let safeReferenceId: number | null = null;

      try {
        console.log(`[INVENTORY STEP 5] movement.purchaseOrderId:`, movement?.purchaseOrderId, typeof movement?.purchaseOrderId);
        safePurchaseOrderId = movement.purchaseOrderId != null ? Number(movement.purchaseOrderId) : null;
        console.log(`[INVENTORY STEP 5] safePurchaseOrderId:`, safePurchaseOrderId);
      } catch (error: any) {
        console.error(`[INVENTORY STEP 5 ERROR] Error extracting purchaseOrderId:`, error?.message);
      }

      try {
        console.log(`[INVENTORY STEP 5] movement.poNumber:`, movement?.poNumber, typeof movement?.poNumber);
        safePoNumber = movement.poNumber != null ? String(movement.poNumber) : null;
        console.log(`[INVENTORY STEP 5] safePoNumber:`, safePoNumber);
      } catch (error: any) {
        console.error(`[INVENTORY STEP 5 ERROR] Error extracting poNumber:`, error?.message);
      }

      try {
        console.log(`[INVENTORY STEP 5] movement.supplierName:`, movement?.supplierName, typeof movement?.supplierName);
        safeSupplierName = movement.supplierName != null ? String(movement.supplierName) : null;
        console.log(`[INVENTORY STEP 5] safeSupplierName:`, safeSupplierName);
      } catch (error: any) {
        console.error(`[INVENTORY STEP 5 ERROR] Error extracting supplierName:`, error?.message);
      }

      try {
        console.log(`[INVENTORY STEP 5] movement.notes:`, movement?.notes, typeof movement?.notes);
        safeNotes = movement.notes != null ? String(movement.notes) : null;
        console.log(`[INVENTORY STEP 5] safeNotes:`, safeNotes);
      } catch (error: any) {
        console.error(`[INVENTORY STEP 5 ERROR] Error extracting notes:`, error?.message);
      }

      try {
        console.log(`[INVENTORY STEP 5] movement.referenceId:`, movement?.referenceId, typeof movement?.referenceId);
        safeReferenceId = movement.referenceId != null ? Number(movement.referenceId) : null;
        console.log(`[INVENTORY STEP 5] safeReferenceId:`, safeReferenceId);
      } catch (error: any) {
        console.error(`[INVENTORY STEP 5 ERROR] Error extracting referenceId:`, error?.message);
      }

      // STEP 6: Fetch purchase order details and items if purchaseOrderId exists
      console.log(`[INVENTORY STEP 6] Fetching purchase order details`);
      let purchaseOrderDetails: any = null;
      let purchaseOrderItems: any[] = [];

      if (safePurchaseOrderId) {
        try {
          console.log(`[INVENTORY STEP 6] Fetching purchase order ${safePurchaseOrderId}`);
          // Fetch purchase order details
          const [poDetails] = await db
            .select({
              id: inventoryPurchaseOrders.id,
              poNumber: inventoryPurchaseOrders.poNumber,
              orderDate: inventoryPurchaseOrders.orderDate,
              expectedDeliveryDate: inventoryPurchaseOrders.expectedDeliveryDate,
              status: inventoryPurchaseOrders.status,
              totalAmount: inventoryPurchaseOrders.totalAmount,
              taxAmount: inventoryPurchaseOrders.taxAmount,
              discountAmount: inventoryPurchaseOrders.discountAmount,
              notes: inventoryPurchaseOrders.notes,
              supplierId: inventoryPurchaseOrders.supplierId,
              supplierName: inventorySuppliers.name,
              supplierEmail: inventorySuppliers.email,
              createdAt: inventoryPurchaseOrders.createdAt,
              updatedAt: inventoryPurchaseOrders.updatedAt,
            })
            .from(inventoryPurchaseOrders)
            .leftJoin(inventorySuppliers, eq(inventoryPurchaseOrders.supplierId, inventorySuppliers.id))
            .where(and(
              eq(inventoryPurchaseOrders.id, safePurchaseOrderId),
              eq(inventoryPurchaseOrders.organizationId, organizationId)
            ))
            .limit(1);

          if (poDetails) {
            console.log(`[INVENTORY STEP 6] Found purchase order: ${poDetails.poNumber}`);
            purchaseOrderDetails = {
              id: poDetails.id ?? null,
              poNumber: poDetails.poNumber ?? null,
              orderDate: poDetails.orderDate ? (poDetails.orderDate instanceof Date ? poDetails.orderDate.toISOString() : String(poDetails.orderDate)) : null,
              expectedDeliveryDate: poDetails.expectedDeliveryDate ? (poDetails.expectedDeliveryDate instanceof Date ? poDetails.expectedDeliveryDate.toISOString() : String(poDetails.expectedDeliveryDate)) : null,
              status: poDetails.status ?? null,
              totalAmount: poDetails.totalAmount != null ? Number(poDetails.totalAmount) : 0,
              taxAmount: poDetails.taxAmount != null ? Number(poDetails.taxAmount) : 0,
              discountAmount: poDetails.discountAmount != null ? Number(poDetails.discountAmount) : 0,
              notes: poDetails.notes ?? null,
              supplierId: poDetails.supplierId ?? null,
              supplierName: poDetails.supplierName ?? null,
              supplierEmail: poDetails.supplierEmail ?? null,
              createdAt: poDetails.createdAt ? (poDetails.createdAt instanceof Date ? poDetails.createdAt.toISOString() : String(poDetails.createdAt)) : null,
              updatedAt: poDetails.updatedAt ? (poDetails.updatedAt instanceof Date ? poDetails.updatedAt.toISOString() : String(poDetails.updatedAt)) : null,
            };

            // Fetch purchase order items
            try {
              console.log(`[INVENTORY STEP 6] Fetching purchase order items for PO ${safePurchaseOrderId}`);
              const poItemsResult = await db
                .select({
                  id: inventoryPurchaseOrderItems.id,
                  itemId: inventoryPurchaseOrderItems.itemId,
                  itemName: inventoryItems.name,
                  quantity: inventoryPurchaseOrderItems.quantity,
                  unitPrice: inventoryPurchaseOrderItems.unitPrice,
                  totalPrice: inventoryPurchaseOrderItems.totalPrice,
                  receivedQuantity: inventoryPurchaseOrderItems.receivedQuantity,
                })
                .from(inventoryPurchaseOrderItems)
                .leftJoin(inventoryItems, eq(inventoryPurchaseOrderItems.itemId, inventoryItems.id))
                .where(and(
                  eq(inventoryPurchaseOrderItems.purchaseOrderId, safePurchaseOrderId),
                  eq(inventoryPurchaseOrderItems.organizationId, organizationId)
                ))
                .orderBy(inventoryPurchaseOrderItems.id);

              purchaseOrderItems = Array.isArray(poItemsResult) ? poItemsResult.map((item: any) => ({
                id: item.id ?? null,
                itemId: item.itemId != null ? Number(item.itemId) : null,
                itemName: item.itemName ?? null,
                quantity: item.quantity != null ? Number(item.quantity) : 0,
                unitPrice: item.unitPrice != null ? Number(item.unitPrice) : 0,
                totalPrice: item.totalPrice != null ? Number(item.totalPrice) : 0,
                receivedQuantity: item.receivedQuantity != null ? Number(item.receivedQuantity) : 0,
              })) : [];
              console.log(`[INVENTORY STEP 6] Found ${purchaseOrderItems.length} purchase order items`);
            } catch (poItemsError: any) {
              console.error(`[INVENTORY STEP 6 ERROR] Error fetching purchase order items:`, poItemsError?.message);
              purchaseOrderItems = [];
            }
          } else {
            console.log(`[INVENTORY STEP 6] Purchase order ${safePurchaseOrderId} not found`);
          }
        } catch (poError: any) {
          console.error(`[INVENTORY STEP 6 ERROR] Error fetching purchase order details:`, poError?.message, poError?.stack);
          // Continue without purchase order details
        }
      } else {
        console.log(`[INVENTORY STEP 6] No purchaseOrderId, skipping purchase order fetch`);
      }

      // STEP 7: Construct return object
      console.log(`[INVENTORY STEP 7] Constructing return object`);
      try {
        const returnObject = { 
          id: movementId,
          receiptNumber: safeReceiptNumber,
          purchaseOrderId: safePurchaseOrderId,
          poNumber: safePoNumber,
          supplierName: safeSupplierName,
          receivedDate: validReceivedDate.toISOString(),
          notes: safeNotes,
          referenceId: safeReferenceId,
          items: safeItemsArray,
          totalAmount: Number(totalAmount) || 0,
          purchaseOrder: purchaseOrderDetails,
          purchaseOrderItems: purchaseOrderItems
        };
        console.log(`[INVENTORY STEP 7 SUCCESS] Return object constructed successfully`);
        console.log(`[INVENTORY STEP 7] Return object keys:`, Object.keys(returnObject));
        return returnObject;
      } catch (error: any) {
        console.error(`[INVENTORY STEP 7 ERROR] Error constructing return object:`, error?.message, error?.stack);
        throw error;
      }
    } catch (error: any) {
      console.error(`[INVENTORY] Error fetching goods receipt ${receiptId}:`, error);
      console.error(`[INVENTORY] Error stack:`, error?.stack);
      console.error(`[INVENTORY] Error message:`, error?.message);
      
      // Re-throw with more context
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('Cannot convert undefined or null to object')) {
        console.error(`[INVENTORY] Null/undefined conversion error detected. This usually means a property access on null/undefined.`);
      }
      
      throw new Error(`Failed to fetch goods receipt ${receiptId}: ${errorMessage}`);
    }
  }

  async checkGoodsReceiptExists(purchaseOrderId: number, organizationId: number): Promise<boolean> {
    try {
      const existingReceipt = await db
        .select({
          id: inventoryStockMovements.id,
        })
        .from(inventoryStockMovements)
        .where(and(
          eq(inventoryStockMovements.organizationId, organizationId),
          eq(inventoryStockMovements.referenceId, purchaseOrderId),
          eq(inventoryStockMovements.movementType, 'purchase')
        ))
        .limit(1);

      return existingReceipt.length > 0;
    } catch (error) {
      console.error(`[INVENTORY] Error checking goods receipt existence:`, error);
      return false;
    }
  }

  async createGoodsReceipt(receiptData: any) {
    return await db.transaction(async (tx) => {
      const movements = [];
      
      // Fetch purchase order items to get unit prices
      let purchaseOrderItemsMap = new Map<number, any>();
      try {
        const poItems = await tx
          .select({
            itemId: inventoryPurchaseOrderItems.itemId,
            unitPrice: inventoryPurchaseOrderItems.unitPrice,
          })
          .from(inventoryPurchaseOrderItems)
          .where(and(
            eq(inventoryPurchaseOrderItems.purchaseOrderId, receiptData.purchaseOrderId),
            eq(inventoryPurchaseOrderItems.organizationId, receiptData.organizationId)
          ));
        
        for (const poItem of poItems) {
          purchaseOrderItemsMap.set(poItem.itemId, {
            unitPrice: poItem.unitPrice ? parseFloat(String(poItem.unitPrice)) : 0
          });
        }
      } catch (error) {
        console.error(`[INVENTORY] Error fetching purchase order items for unit prices:`, error);
      }
      
      for (const item of receiptData.items) {
        // Get unit price from purchase order items
        const poItem = purchaseOrderItemsMap.get(item.itemId);
        const unitCost = poItem?.unitPrice || item.unitPrice || 0;
        
        // Create stock movement for receipt
        const [movement] = await tx
          .insert(inventoryStockMovements)
          .values({
            organizationId: receiptData.organizationId,
            itemId: item.itemId,
            movementType: 'purchase',
            quantity: item.quantityReceived,
            previousStock: 0, // Will be updated
            newStock: 0, // Will be updated
            unitCost: unitCost > 0 ? String(unitCost) : null,
            referenceType: 'purchase_order',
            referenceId: receiptData.purchaseOrderId,
            notes: receiptData.notes,
            createdBy: 1, // TODO: Get from user context
          })
          .returning();

        // Update item stock
        await this.updateStock(
          item.itemId,
          receiptData.organizationId,
          item.quantityReceived,
          'purchase',
          receiptData.notes,
          1 // TODO: Get from user context
        );

        // Create batch if batch info provided
        if (item.batchNumber || item.expiryDate) {
          await tx
            .insert(inventoryBatches)
            .values({
              organizationId: receiptData.organizationId,
              itemId: item.itemId,
              batchNumber: item.batchNumber || `BATCH-${Date.now()}`,
              quantity: item.quantityReceived,
              remainingQuantity: item.quantityReceived,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              manufactureDate: item.manufactureDate ? new Date(item.manufactureDate) : null,
              purchasePrice: poItem?.unitPrice ? String(poItem.unitPrice) : (item.unitPrice || '0.00'),
              receivedDate: new Date(receiptData.receivedDate),
              status: 'active'
            });
        }

        movements.push(movement);
      }

      console.log(`[INVENTORY] Created goods receipt with ${movements.length} items`);
      return { 
        id: movements[0]?.id,
        receiptNumber: `GR-${movements[0]?.id}`,
        items: movements 
      };
    });
  }

  async deleteGoodsReceipt(receiptId: number, organizationId: number) {
    try {
      // First, try to get the goods receipt to find related movements
      // But don't fail if getGoodsReceiptById fails - we can still delete by receiptId
      let receipt: any = null;
      try {
        receipt = await this.getGoodsReceiptById(receiptId, organizationId);
      } catch (getReceiptError) {
        console.warn(`[INVENTORY] Could not fetch receipt details for ${receiptId}, will delete by receiptId directly:`, getReceiptError);
      }

      return await db.transaction(async (tx) => {
        // Get all movements for this receipt
        // If receipt has a purchaseOrderId (referenceId), use it; otherwise use receiptId directly
        let movements;
        if (receipt?.purchaseOrderId) {
          // Get movements by referenceId (purchase order)
          movements = await tx
            .select()
            .from(inventoryStockMovements)
            .where(and(
              eq(inventoryStockMovements.organizationId, organizationId),
              eq(inventoryStockMovements.referenceId, receipt.purchaseOrderId),
              eq(inventoryStockMovements.movementType, 'purchase')
            ));
        } else {
          // Get movements by receiptId (single movement or movements created on same day)
          // First get the initial movement to find its createdAt date
          const [initialMovement] = await tx
            .select()
            .from(inventoryStockMovements)
            .where(and(
              eq(inventoryStockMovements.organizationId, organizationId),
              eq(inventoryStockMovements.id, receiptId),
              eq(inventoryStockMovements.movementType, 'purchase')
            ))
            .limit(1);

          if (!initialMovement) {
            console.log(`[INVENTORY] Goods receipt ${receiptId} not found`);
            return false;
          }

          // Get all movements created on the same day (for goods receipts without referenceId)
          const receiptDate = initialMovement.createdAt instanceof Date 
            ? initialMovement.createdAt 
            : new Date(initialMovement.createdAt);
          const receiptDateStart = new Date(receiptDate);
          receiptDateStart.setHours(0, 0, 0, 0);
          const receiptDateEnd = new Date(receiptDate);
          receiptDateEnd.setHours(23, 59, 59, 999);

          movements = await tx
            .select()
            .from(inventoryStockMovements)
            .where(and(
              eq(inventoryStockMovements.organizationId, organizationId),
              eq(inventoryStockMovements.id, receiptId),
              eq(inventoryStockMovements.movementType, 'purchase'),
              gte(inventoryStockMovements.createdAt, receiptDateStart),
              lte(inventoryStockMovements.createdAt, receiptDateEnd)
            ));
        }

        // Reverse stock for each movement
        for (const movement of movements) {
          if (movement.itemId) {
            // Get current stock
            const item = await tx
              .select()
              .from(inventoryItems)
              .where(and(
                eq(inventoryItems.id, movement.itemId),
                eq(inventoryItems.organizationId, organizationId)
              ))
              .limit(1);

            if (item.length > 0) {
              const currentStock = item[0].currentStock || 0;
              const newStock = Math.max(0, currentStock - movement.quantity);
              
              // Update stock
              await tx
                .update(inventoryItems)
                .set({ currentStock: newStock })
                .where(eq(inventoryItems.id, movement.itemId));
            }
          }
        }

        // Delete all movements for this receipt
        if (receipt?.purchaseOrderId) {
          await tx
            .delete(inventoryStockMovements)
            .where(and(
              eq(inventoryStockMovements.organizationId, organizationId),
              eq(inventoryStockMovements.referenceId, receipt.purchaseOrderId),
              eq(inventoryStockMovements.movementType, 'purchase')
            ));
        } else {
          // Delete by receiptId and date range
          const [initialMovement] = await tx
            .select()
            .from(inventoryStockMovements)
            .where(and(
              eq(inventoryStockMovements.organizationId, organizationId),
              eq(inventoryStockMovements.id, receiptId),
              eq(inventoryStockMovements.movementType, 'purchase')
            ))
            .limit(1);

          if (initialMovement) {
            const receiptDate = initialMovement.createdAt instanceof Date 
              ? initialMovement.createdAt 
              : new Date(initialMovement.createdAt);
            const receiptDateStart = new Date(receiptDate);
            receiptDateStart.setHours(0, 0, 0, 0);
            const receiptDateEnd = new Date(receiptDate);
            receiptDateEnd.setHours(23, 59, 59, 999);

            await tx
              .delete(inventoryStockMovements)
              .where(and(
                eq(inventoryStockMovements.organizationId, organizationId),
                eq(inventoryStockMovements.id, receiptId),
                eq(inventoryStockMovements.movementType, 'purchase'),
                gte(inventoryStockMovements.createdAt, receiptDateStart),
                lte(inventoryStockMovements.createdAt, receiptDateEnd)
              ));
          }
        }

        console.log(`[INVENTORY] Successfully deleted goods receipt ${receiptId} and ${movements.length} movements`);
        return true;
      });
    } catch (error) {
      console.error(`[INVENTORY] Error deleting goods receipt ${receiptId}:`, error);
      throw error;
    }
  }

  async getBatches(organizationId: number) {
    const batches = await db
      .select({
        id: inventoryBatches.id,
        itemId: inventoryBatches.itemId,
        itemName: inventoryItems.name,
        batchNumber: inventoryBatches.batchNumber,
        quantityAvailable: inventoryBatches.remainingQuantity,
        location: sql<string>`'Pharmacy'`.as('location'), // Default location
        expiryDate: inventoryBatches.expiryDate,
        manufactureDate: inventoryBatches.manufactureDate,
        supplierId: inventoryBatches.supplierId,
        supplierName: inventorySuppliers.name,
        purchasePrice: inventoryBatches.purchasePrice,
        receivedDate: inventoryBatches.receivedDate,
        isExpired: inventoryBatches.isExpired,
        status: inventoryBatches.status,
        createdAt: inventoryBatches.createdAt
      })
      .from(inventoryBatches)
      .leftJoin(inventoryItems, eq(inventoryBatches.itemId, inventoryItems.id))
      .leftJoin(inventorySuppliers, eq(inventoryBatches.supplierId, inventorySuppliers.id))
      .where(eq(inventoryBatches.organizationId, organizationId))
      .orderBy(desc(inventoryBatches.createdAt));

    return batches;
  }

  // ====== PHARMACY SALES MODULE ======

  /**
   * Get available batches for an item using FEFO (First Expiry First Out) logic
   * Returns batches sorted by expiry date (earliest first), excluding expired batches
   */
  async getAvailableBatchesFEFO(itemId: number, organizationId: number) {
    const batches = await db
      .select({
        id: inventoryBatches.id,
        batchNumber: inventoryBatches.batchNumber,
        remainingQuantity: inventoryBatches.remainingQuantity,
        expiryDate: inventoryBatches.expiryDate,
        purchasePrice: inventoryBatches.purchasePrice,
        manufactureDate: inventoryBatches.manufactureDate
      })
      .from(inventoryBatches)
      .where(and(
        eq(inventoryBatches.itemId, itemId),
        eq(inventoryBatches.organizationId, organizationId),
        eq(inventoryBatches.status, 'active'),
        eq(inventoryBatches.isExpired, false),
        gt(inventoryBatches.remainingQuantity, 0),
        or(
          isNull(inventoryBatches.expiryDate),
          gt(inventoryBatches.expiryDate, new Date())
        )
      ))
      .orderBy(asc(inventoryBatches.expiryDate)); // FEFO: earliest expiry first

    return batches;
  }

  /**
   * Select batches for a sale item using FEFO algorithm
   * Returns the batch allocations needed to fulfill the requested quantity
   */
  async selectBatchesFEFO(itemId: number, organizationId: number, requiredQuantity: number) {
    const availableBatches = await this.getAvailableBatchesFEFO(itemId, organizationId);
    const allocations: Array<{
      batchId: number;
      batchNumber: string | null;
      quantity: number;
      expiryDate: Date | null;
      costPrice: string;
    }> = [];
    
    let remainingQty = requiredQuantity;
    
    for (const batch of availableBatches) {
      if (remainingQty <= 0) break;
      
      const allocateQty = Math.min(remainingQty, batch.remainingQuantity);
      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: allocateQty,
        expiryDate: batch.expiryDate,
        costPrice: batch.purchasePrice
      });
      
      remainingQty -= allocateQty;
    }
    
    if (remainingQty > 0) {
      throw new Error(`Insufficient stock. Available: ${requiredQuantity - remainingQty}, Requested: ${requiredQuantity}`);
    }
    
    return allocations;
  }

  /**
   * Create a new sale with FEFO batch deduction and multi-payment support
   */
  async createSale(saleData: {
    organizationId: number;
    patientId?: number;
    saleType: 'walk_in' | 'prescription';
    customerName?: string;
    customerPhone?: string;
    prescriptionId?: number;
    items: Array<{
      itemId: number;
      quantity: number;
      discountPercent?: number;
    }>;
    payments: Array<{
      method: 'cash' | 'card' | 'insurance' | 'credit_note';
      amount: number;
      cardLast4?: string;
      cardType?: string;
      authorizationCode?: string;
      insuranceProviderId?: number;
      claimNumber?: string;
    }>;
    discountType?: 'percentage' | 'fixed';
    discountAmount?: number;
    notes?: string;
    soldBy: number;
  }) {
    return await db.transaction(async (tx) => {
      // Generate sale and invoice numbers
      const saleNumber = `SALE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      // Get tax rate
      const [defaultTax] = await tx
        .select()
        .from(inventoryTaxRates)
        .where(and(
          eq(inventoryTaxRates.organizationId, saleData.organizationId),
          eq(inventoryTaxRates.isDefault, true),
          eq(inventoryTaxRates.isActive, true)
        ))
        .limit(1);

      const taxRate = defaultTax ? parseFloat(defaultTax.rate) : 0;

      let subtotalAmount = 0;
      let totalTaxAmount = 0;
      const saleItems: Array<InsertInventorySaleItem> = [];

      // Process each item - select batches FEFO and calculate prices
      for (const item of saleData.items) {
        // Get item details
        const [itemDetails] = await tx
          .select()
          .from(inventoryItems)
          .where(and(
            eq(inventoryItems.id, item.itemId),
            eq(inventoryItems.organizationId, saleData.organizationId)
          ));

        if (!itemDetails) {
          throw new Error(`Item ${item.itemId} not found`);
        }

        // Select batches using FEFO
        const batchAllocations = await this.selectBatchesFEFO(
          item.itemId, 
          saleData.organizationId, 
          item.quantity
        );

        // Create sale item entries for each batch allocation
        for (const allocation of batchAllocations) {
          const unitPrice = parseFloat(itemDetails.salePrice);
          const discountPercent = item.discountPercent || 0;
          const lineSubtotal = unitPrice * allocation.quantity;
          const discountAmount = lineSubtotal * (discountPercent / 100);
          const taxableAmount = lineSubtotal - discountAmount;
          const lineTax = taxableAmount * (taxRate / 100);
          const lineTotal = taxableAmount + lineTax;

          subtotalAmount += lineSubtotal;
          totalTaxAmount += lineTax;

          saleItems.push({
            organizationId: saleData.organizationId,
            saleId: 0, // Will be set after sale creation
            itemId: item.itemId,
            batchId: allocation.batchId,
            batchNumber: allocation.batchNumber,
            expiryDate: allocation.expiryDate,
            quantity: allocation.quantity,
            unitPrice: unitPrice.toString(),
            costPrice: allocation.costPrice,
            discountPercent: discountPercent.toString(),
            discountAmount: discountAmount.toString(),
            taxPercent: taxRate.toString(),
            taxAmount: lineTax.toString(),
            totalPrice: lineTotal.toString(),
            status: 'sold'
          });

          // Deduct from batch
          await tx
            .update(inventoryBatches)
            .set({
              remainingQuantity: sql`${inventoryBatches.remainingQuantity} - ${allocation.quantity}`
            })
            .where(eq(inventoryBatches.id, allocation.batchId));

          // Deduct from item stock
          await tx
            .update(inventoryItems)
            .set({
              currentStock: sql`${inventoryItems.currentStock} - ${allocation.quantity}`,
              updatedAt: new Date()
            })
            .where(eq(inventoryItems.id, item.itemId));

          // Create stock movement record
          await tx
            .insert(inventoryStockMovements)
            .values({
              organizationId: saleData.organizationId,
              itemId: item.itemId,
              batchId: allocation.batchId,
              movementType: 'sale',
              quantity: -allocation.quantity,
              previousStock: itemDetails.currentStock,
              newStock: itemDetails.currentStock - allocation.quantity,
              unitCost: allocation.costPrice,
              referenceType: 'sale',
              notes: `Sale ${saleNumber}`,
              createdBy: saleData.soldBy
            });
        }
      }

      // Apply overall discount
      let orderDiscount = 0;
      if (saleData.discountAmount && saleData.discountAmount > 0) {
        if (saleData.discountType === 'percentage') {
          orderDiscount = subtotalAmount * (saleData.discountAmount / 100);
        } else {
          orderDiscount = saleData.discountAmount;
        }
      }

      const totalAmount = subtotalAmount + totalTaxAmount - orderDiscount;
      const totalPaid = saleData.payments.reduce((sum, p) => sum + p.amount, 0);
      const amountDue = Math.max(0, totalAmount - totalPaid);
      const changeGiven = Math.max(0, totalPaid - totalAmount);

      // Create the sale record
      const [sale] = await tx
        .insert(inventorySales)
        .values({
          organizationId: saleData.organizationId,
          patientId: saleData.patientId,
          saleNumber,
          invoiceNumber,
          saleType: saleData.saleType,
          customerName: saleData.customerName,
          customerPhone: saleData.customerPhone,
          saleDate: new Date(),
          subtotalAmount: subtotalAmount.toString(),
          totalAmount: totalAmount.toString(),
          taxAmount: totalTaxAmount.toString(),
          discountAmount: orderDiscount.toString(),
          discountType: saleData.discountType,
          paymentMethod: saleData.payments.length === 1 ? saleData.payments[0].method : 'multi',
          paymentStatus: amountDue > 0 ? 'partial' : 'paid',
          amountPaid: totalPaid.toString(),
          amountDue: amountDue.toString(),
          changeGiven: changeGiven.toString(),
          prescriptionId: saleData.prescriptionId,
          soldBy: saleData.soldBy,
          status: 'completed',
          notes: saleData.notes
        })
        .returning();

      // Insert sale items
      for (const saleItem of saleItems) {
        await tx
          .insert(inventorySaleItems)
          .values({ ...saleItem, saleId: sale.id });
      }

      // Insert payment records
      for (const payment of saleData.payments) {
        await tx
          .insert(inventorySalePayments)
          .values({
            organizationId: saleData.organizationId,
            saleId: sale.id,
            paymentMethod: payment.method,
            amount: payment.amount.toString(),
            cardLast4: payment.cardLast4,
            cardType: payment.cardType,
            authorizationCode: payment.authorizationCode,
            insuranceProviderId: payment.insuranceProviderId,
            claimNumber: payment.claimNumber,
            status: 'completed',
            processedBy: saleData.soldBy
          });
      }

      console.log(`[INVENTORY] Created sale ${saleNumber} with ${saleItems.length} items for organization ${saleData.organizationId}`);

      return {
        ...sale,
        items: saleItems,
        payments: saleData.payments
      };
    });
  }

  async getSales(organizationId: number, filters?: {
    startDate?: Date;
    endDate?: Date;
    patientId?: number;
    status?: string;
    limit?: number;
  }) {
    const conditions = [eq(inventorySales.organizationId, organizationId)];

    if (filters?.startDate) {
      conditions.push(gte(inventorySales.saleDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(inventorySales.saleDate, filters.endDate));
    }
    if (filters?.patientId) {
      conditions.push(eq(inventorySales.patientId, filters.patientId));
    }
    if (filters?.status) {
      conditions.push(eq(inventorySales.status, filters.status));
    }

    let query = db
      .select()
      .from(inventorySales)
      .where(and(...conditions))
      .orderBy(desc(inventorySales.saleDate));

    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }

    return await query;
  }

  async getSaleById(saleId: number, organizationId: number) {
    try {
      const saleQuery = `
        SELECT * FROM inventory_sales 
        WHERE id = $1 AND organization_id = $2
      `;
      const saleResult = await pool.query(saleQuery, [saleId, organizationId]);
      
      if (saleResult.rows.length === 0) return null;
      
      const sale = saleResult.rows[0];
      
      // Format sale with camelCase keys
      const formattedSale = {
        id: sale.id,
        organizationId: sale.organization_id,
        patientId: sale.patient_id,
        saleNumber: sale.sale_number,
        invoiceNumber: sale.invoice_number,
        saleType: sale.sale_type,
        customerName: sale.customer_name,
        customerPhone: sale.customer_phone,
        saleDate: sale.sale_date,
        subtotalAmount: sale.subtotal_amount,
        totalAmount: sale.total_amount,
        taxAmount: sale.tax_amount,
        discountAmount: sale.discount_amount,
        discountType: sale.discount_type,
        discountReason: sale.discount_reason,
        paymentMethod: sale.payment_method,
        paymentStatus: sale.payment_status,
        amountPaid: sale.amount_paid,
        amountDue: sale.amount_due,
        changeGiven: sale.change_given,
        soldBy: sale.sold_by,
        shiftId: sale.shift_id,
        status: sale.status,
        notes: sale.notes,
        createdAt: sale.created_at,
        updatedAt: sale.updated_at
      };
      
      // Fetch items with fallback for missing returned_quantity column
      let items: any[] = [];
      try {
        const itemsQuery = `
          SELECT 
            si.id, si.item_id as "itemId", i.name as "itemName",
            si.batch_id as "batchId", si.batch_number as "batchNumber",
            si.quantity, COALESCE(si.returned_quantity, 0) as "returnedQuantity",
            si.unit_price as "unitPrice", si.discount_amount as "discountAmount",
            si.tax_amount as "taxAmount", si.total_price as "totalPrice",
            si.status
          FROM inventory_sale_items si
          LEFT JOIN inventory_items i ON si.item_id = i.id
          WHERE si.sale_id = $1
        `;
        const itemsResult = await pool.query(itemsQuery, [saleId]);
        items = itemsResult.rows;
      } catch (itemsError: any) {
        console.log('Error fetching items with returned_quantity, trying without:', itemsError.message);
        const itemsQuery = `
          SELECT 
            si.id, si.item_id as "itemId", i.name as "itemName",
            si.batch_id as "batchId", si.batch_number as "batchNumber",
            si.quantity, 0 as "returnedQuantity",
            si.unit_price as "unitPrice", si.discount_amount as "discountAmount",
            si.tax_amount as "taxAmount", si.total_price as "totalPrice",
            si.status
          FROM inventory_sale_items si
          LEFT JOIN inventory_items i ON si.item_id = i.id
          WHERE si.sale_id = $1
        `;
        const itemsResult = await pool.query(itemsQuery, [saleId]);
        items = itemsResult.rows;
      }
      
      // Fetch payments
      const paymentsQuery = `SELECT * FROM inventory_sale_payments WHERE sale_id = $1`;
      const paymentsResult = await pool.query(paymentsQuery, [saleId]);
      const payments = paymentsResult.rows;
      
      return { ...formattedSale, items, payments };
    } catch (error: any) {
      console.error('Error in getSaleById:', error.message);
      throw error;
    }
  }

  async voidSale(saleId: number, organizationId: number, voidReason: string, voidedBy: number) {
    return await db.transaction(async (tx) => {
      // Get sale and items
      const [sale] = await tx
        .select()
        .from(inventorySales)
        .where(and(
          eq(inventorySales.id, saleId),
          eq(inventorySales.organizationId, organizationId)
        ));

      if (!sale) throw new Error('Sale not found');
      if (sale.status === 'voided') throw new Error('Sale already voided');

      const items = await tx
        .select()
        .from(inventorySaleItems)
        .where(eq(inventorySaleItems.saleId, saleId));

      // Restore stock for each item
      for (const item of items) {
        // Restore batch quantity
        await tx
          .update(inventoryBatches)
          .set({
            remainingQuantity: sql`${inventoryBatches.remainingQuantity} + ${item.quantity}`
          })
          .where(eq(inventoryBatches.id, item.batchId));

        // Restore item stock
        await tx
          .update(inventoryItems)
          .set({
            currentStock: sql`${inventoryItems.currentStock} + ${item.quantity}`,
            updatedAt: new Date()
          })
          .where(eq(inventoryItems.id, item.itemId));

        // Create reversal stock movement
        await tx
          .insert(inventoryStockMovements)
          .values({
            organizationId,
            itemId: item.itemId,
            batchId: item.batchId,
            movementType: 'adjustment',
            quantity: item.quantity,
            previousStock: 0,
            newStock: 0,
            referenceType: 'sale_void',
            referenceId: saleId,
            notes: `Void sale ${sale.saleNumber}: ${voidReason}`,
            createdBy: voidedBy
          });
      }

      // Update sale status
      const [voidedSale] = await tx
        .update(inventorySales)
        .set({
          status: 'voided',
          voidedAt: new Date(),
          voidedBy,
          voidReason,
          updatedAt: new Date()
        })
        .where(eq(inventorySales.id, saleId))
        .returning();

      console.log(`[INVENTORY] Voided sale ${sale.saleNumber} for organization ${organizationId}`);
      return voidedSale;
    });
  }

  // ====== TAX RATES ======

  async getTaxRates(organizationId: number) {
    return await db
      .select()
      .from(inventoryTaxRates)
      .where(and(
        eq(inventoryTaxRates.organizationId, organizationId),
        eq(inventoryTaxRates.isActive, true)
      ))
      .orderBy(inventoryTaxRates.name);
  }

  async createTaxRate(taxData: InsertInventoryTaxRate) {
    const [taxRate] = await db
      .insert(inventoryTaxRates)
      .values(taxData)
      .returning();
    return taxRate;
  }

  // ====== INSURANCE PROVIDERS ======

  async getInsuranceProviders(organizationId: number) {
    return await db
      .select()
      .from(insuranceProviders)
      .where(and(
        eq(insuranceProviders.organizationId, organizationId),
        eq(insuranceProviders.isActive, true)
      ))
      .orderBy(insuranceProviders.name);
  }

  async createInsuranceProvider(providerData: InsertInsuranceProvider) {
    const [provider] = await db
      .insert(insuranceProviders)
      .values(providerData)
      .returning();
    return provider;
  }

  // ====== RETURNS MANAGEMENT MODULE ======

  /**
   * Create a sales return (customer returning items)
   */
  async createSalesReturn(returnData: {
    organizationId: number;
    originalSaleId: number;
    patientId?: number;
    customerName?: string;
    customerPhone?: string;
    items: Array<{
      originalSaleItemId: number;
      itemId: number;
      batchId: number;
      returnedQuantity: number;
      conditionOnReturn: 'sealed' | 'opened' | 'damaged' | 'expired';
      isRestockable: boolean;
    }>;
    returnReason: string;
    returnReasonDetails?: string;
    settlementType: 'refund' | 'credit_note' | 'exchange';
    restockingFeePercent?: number;
    initiatedBy: number;
    internalNotes?: string;
  }) {
    return await db.transaction(async (tx) => {
      // Validate original sale
      const [originalSale] = await tx
        .select()
        .from(inventorySales)
        .where(and(
          eq(inventorySales.id, returnData.originalSaleId),
          eq(inventorySales.organizationId, returnData.organizationId)
        ));

      if (!originalSale) throw new Error('Original sale not found');
      if (originalSale.status === 'voided') throw new Error('Cannot return voided sale');

      // Get original sale items for validation
      const originalItems = await tx
        .select()
        .from(inventorySaleItems)
        .where(eq(inventorySaleItems.saleId, returnData.originalSaleId));

      const returnNumber = `RET-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      let subtotalAmount = 0;
      let taxAmount = 0;
      const returnItems: Array<InsertInventoryReturnItem> = [];

      // Process each return item
      for (const item of returnData.items) {
        const originalItem = originalItems.find(oi => oi.id === item.originalSaleItemId);
        if (!originalItem) throw new Error(`Original sale item ${item.originalSaleItemId} not found`);

        // Validate return quantity
        const alreadyReturned = originalItem.returnedQuantity || 0;
        const maxReturnable = originalItem.quantity - alreadyReturned;
        if (item.returnedQuantity > maxReturnable) {
          throw new Error(`Cannot return more than ${maxReturnable} units for item ${item.itemId}`);
        }

        const lineTotal = parseFloat(originalItem.unitPrice) * item.returnedQuantity;
        const lineTax = parseFloat(originalItem.taxAmount || '0') * (item.returnedQuantity / originalItem.quantity);
        
        subtotalAmount += lineTotal;
        taxAmount += lineTax;

        returnItems.push({
          organizationId: returnData.organizationId,
          returnId: 0, // Will be set after return creation
          itemId: item.itemId,
          originalSaleItemId: item.originalSaleItemId,
          batchId: item.batchId,
          batchNumber: originalItem.batchNumber,
          expiryDate: originalItem.expiryDate,
          returnedQuantity: item.returnedQuantity,
          unitPrice: originalItem.unitPrice,
          costPrice: originalItem.costPrice,
          taxAmount: lineTax.toString(),
          lineTotal: lineTotal.toString(),
          conditionOnReturn: item.conditionOnReturn,
          isRestockable: item.isRestockable,
          status: 'pending'
        });

        // Update original sale item returned quantity using raw SQL
        try {
          await pool.query(
            `UPDATE inventory_sale_items SET returned_quantity = COALESCE(returned_quantity, 0) + $1 WHERE id = $2`,
            [item.returnedQuantity, item.originalSaleItemId]
          );
        } catch (updateErr: any) {
          console.log('Note: returned_quantity update skipped (column may not exist):', updateErr.message);
        }
      }

      // Calculate restocking fee
      const restockingFee = returnData.restockingFeePercent 
        ? subtotalAmount * (returnData.restockingFeePercent / 100)
        : 0;

      const totalAmount = subtotalAmount + taxAmount;
      const netRefundAmount = totalAmount - restockingFee;

      // Determine if approval required (e.g., for high value returns)
      const requiresApproval = totalAmount > 100; // Configurable threshold

      // Create return record using raw SQL matching actual database columns
      const returnStatus = requiresApproval ? 'pending_approval' : 'pending';
      const patientId = returnData.patientId || originalSale.patientId || null;
      const customerName = returnData.customerName || originalSale.customerName || null;
      const customerPhone = returnData.customerPhone || originalSale.customerPhone || null;
      const returnDate = returnData.returnDate ? new Date(returnData.returnDate) : new Date();
      
      // Actual columns: id, organization_id, return_number, sale_id, patient_id, customer_name,
      // customer_phone, return_date, return_type, return_reason, subtotal_amount, total_amount,
      // refund_amount, restocking_fee, settlement_type, settlement_status, credit_note_number,
      // credit_note_amount, exchange_sale_id, status, processed_by, approved_by, approved_at,
      // approval_notes, shift_id, notes, created_at, updated_at
      
      const insertReturnQuery = `
        INSERT INTO inventory_returns (
          organization_id, return_number, original_sale_id, return_type, 
          patient_id, customer_name, customer_phone,
          subtotal_amount, total_amount, net_refund_amount, restocking_fee,
        settlement_type, return_reason, internal_notes,
          status, processed_by, initiated_by, return_date, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
        ) RETURNING *
      `;
      
      const returnResult = await pool.query(insertReturnQuery, [
        returnData.organizationId,
        returnNumber,
        returnData.originalSaleId,
        'sales_return',
        patientId,
        customerName,
        customerPhone,
        subtotalAmount.toString(),
        totalAmount.toString(),
        netRefundAmount.toString(),
        restockingFee.toString(),
        returnData.settlementType,
        returnData.returnReason,
        returnData.internalNotes || returnData.returnReasonDetails || null,
        returnStatus,
        returnData.processedBy || null,
        returnData.initiatedBy,
        returnDate
      ]);
      
      const returnRecord = returnResult.rows[0];

      // Insert return items using raw SQL matching actual DB columns:
      // id, organization_id, return_id, sale_item_id, item_id, batch_id, quantity,
      // unit_price, total_amount, item_condition, restockable, restocked, reason, notes, created_at
      for (const returnItem of returnItems) {
        const insertItemQuery = `
        INSERT INTO inventory_return_items (
            organization_id, return_id, original_sale_item_id, item_id, batch_id,
            returned_quantity, unit_price, line_total,
            condition_on_return, is_restockable, inspection_notes, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
          )
        `;
        await pool.query(insertItemQuery, [
          returnItem.organizationId,
          returnRecord.id,
          returnItem.originalSaleItemId,
          returnItem.itemId,
          returnItem.batchId || null,
          returnItem.returnedQuantity,
          returnItem.unitPrice,
          returnItem.lineTotal,
          returnItem.conditionOnReturn || 'good',
          returnItem.isRestockable !== false,
          returnItem.notes || null
        ]);
      }

      // Note: inventory_return_approvals table doesn't exist in external DB
      // Approval workflow is tracked via status field on inventory_returns

      console.log(`[INVENTORY] Created sales return ${returnNumber} for sale ${originalSale.saleNumber}`);
      return { ...returnRecord, items: returnItems };
    });
  }

  /**
   * Approve or reject a return
   */
  async processReturnApproval(
    returnId: number, 
    organizationId: number, 
    approverId: number, 
    decision: 'approved' | 'rejected',
    notes?: string
  ) {
    return await db.transaction(async (tx) => {
      const [returnRecord] = await tx
        .select()
        .from(inventoryReturns)
        .where(and(
          eq(inventoryReturns.id, returnId),
          eq(inventoryReturns.organizationId, organizationId)
        ));

      if (!returnRecord) throw new Error('Return not found');
      if (returnRecord.status !== 'pending_approval') {
        throw new Error('Return is not pending approval');
      }

      // Update approval record
      await tx
        .update(inventoryReturnApprovals)
        .set({
          approverId,
          decision,
          decisionNotes: notes,
          decisionAt: new Date()
        })
        .where(eq(inventoryReturnApprovals.returnId, returnId));

      if (decision === 'approved') {
        // Update return status and process
        await tx
          .update(inventoryReturns)
          .set({
            status: 'approved',
            approvedBy: approverId,
            approvedAt: new Date(),
            approvalNotes: notes,
            updatedAt: new Date()
          })
          .where(eq(inventoryReturns.id, returnId));

        // Process the return (restock items, issue refund/credit note)
        await this.processApprovedReturn(tx, returnId, organizationId, approverId);
      } else {
        // Reject the return
        await tx
          .update(inventoryReturns)
          .set({
            status: 'rejected',
            rejectedBy: approverId,
            rejectedAt: new Date(),
            rejectionReason: notes,
            updatedAt: new Date()
          })
          .where(eq(inventoryReturns.id, returnId));
      }

      const [updatedReturn] = await tx
        .select()
        .from(inventoryReturns)
        .where(eq(inventoryReturns.id, returnId));

      return updatedReturn;
    });
  }

  private async processApprovedReturn(tx: any, returnId: number, organizationId: number, processedBy: number) {
    const returnItems = await tx
      .select()
      .from(inventoryReturnItems)
      .where(eq(inventoryReturnItems.returnId, returnId));

    const [returnRecord] = await tx
      .select()
      .from(inventoryReturns)
      .where(eq(inventoryReturns.id, returnId));

    // Restock items that are restockable
    for (const item of returnItems) {
      if (item.isRestockable) {
        // Update batch quantity
        await tx
          .update(inventoryBatches)
          .set({
            remainingQuantity: sql`${inventoryBatches.remainingQuantity} + ${item.returnedQuantity}`
          })
          .where(eq(inventoryBatches.id, item.batchId));

        // Update item stock
        await tx
          .update(inventoryItems)
          .set({
            currentStock: sql`${inventoryItems.currentStock} + ${item.returnedQuantity}`,
            updatedAt: new Date()
          })
          .where(eq(inventoryItems.id, item.itemId));

        // Create stock adjustment record
        await tx
          .insert(inventoryStockAdjustments)
          .values({
            organizationId,
            adjustmentNumber: `ADJ-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            adjustmentType: 'return_restock',
            referenceType: 'return',
            referenceId: returnId,
            itemId: item.itemId,
            batchId: item.batchId,
            previousQuantity: 0,
            adjustmentQuantity: item.returnedQuantity,
            newQuantity: 0,
            reason: `Sales return restock - ${returnRecord.returnNumber}`,
            adjustedBy: processedBy
          });

        // Update return item status
        await tx
          .update(inventoryReturnItems)
          .set({ status: 'restocked', disposition: 'restocked' })
          .where(eq(inventoryReturnItems.id, item.id));
      } else {
        // Mark as disposed
        await tx
          .update(inventoryReturnItems)
          .set({ status: 'disposed', disposition: 'disposed' })
          .where(eq(inventoryReturnItems.id, item.id));
      }
    }

    // Issue credit note if settlement type is credit_note
    if (returnRecord.settlementType === 'credit_note') {
      const creditNoteNumber = `CN-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      await tx
        .insert(inventoryCreditNotes)
        .values({
          organizationId,
          creditNoteNumber,
          creditNoteType: 'sales_return',
          returnId,
          originalInvoiceNumber: returnRecord.originalInvoiceNumber,
          patientId: returnRecord.patientId,
          recipientName: returnRecord.customerName,
          originalAmount: returnRecord.netRefundAmount,
          remainingAmount: returnRecord.netRefundAmount,
          issuedBy: processedBy
        });

      await tx
        .update(inventoryReturns)
        .set({
          creditNoteNumber,
          creditNoteAmount: returnRecord.netRefundAmount
        })
        .where(eq(inventoryReturns.id, returnId));
    }

    // Complete the return
    await tx
      .update(inventoryReturns)
      .set({
        status: 'completed',
        processedBy,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(inventoryReturns.id, returnId));
  }

  async getReturns(organizationId: number, filters?: {
    returnType?: 'sales_return' | 'purchase_return';
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const conditions = [eq(inventoryReturns.organizationId, organizationId)];

    if (filters?.returnType) {
      conditions.push(eq(inventoryReturns.returnType, filters.returnType));
    }
    if (filters?.status) {
      conditions.push(eq(inventoryReturns.status, filters.status));
    }
    if (filters?.startDate) {
      conditions.push(gte(inventoryReturns.returnDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(inventoryReturns.returnDate, filters.endDate));
    }

    try {
      const basicQuery = `
        SELECT id, organization_id as "organizationId", return_number as "returnNumber", 
               return_type as "returnType", return_date as "returnDate",
               total_amount as "totalAmount", total_amount as "netRefundAmount",
               settlement_type as "settlementType", return_reason as "returnReason",
               status, created_at as "createdAt"
        FROM inventory_returns 
        WHERE organization_id = $1
        ORDER BY return_date DESC
      `;
      const result = await pool.query(basicQuery, [organizationId]);
      return result.rows;
    } catch (error: any) {
      console.error('Error fetching returns:', error.message);
      return [];
    }
  }

  async getReturnById(returnId: number, organizationId: number) {
    const [returnRecord] = await db
      .select()
      .from(inventoryReturns)
      .where(and(
        eq(inventoryReturns.id, returnId),
        eq(inventoryReturns.organizationId, organizationId)
      ));

    if (!returnRecord) return null;

    const items = await db
      .select({
        id: inventoryReturnItems.id,
        itemId: inventoryReturnItems.itemId,
        itemName: inventoryItems.name,
        batchId: inventoryReturnItems.batchId,
        batchNumber: inventoryReturnItems.batchNumber,
        returnedQuantity: inventoryReturnItems.returnedQuantity,
        unitPrice: inventoryReturnItems.unitPrice,
        lineTotal: inventoryReturnItems.lineTotal,
        conditionOnReturn: inventoryReturnItems.conditionOnReturn,
        isRestockable: inventoryReturnItems.isRestockable,
        disposition: inventoryReturnItems.disposition,
        status: inventoryReturnItems.status
      })
      .from(inventoryReturnItems)
      .leftJoin(inventoryItems, eq(inventoryReturnItems.itemId, inventoryItems.id))
      .where(eq(inventoryReturnItems.returnId, returnId));

    const approvals = await db
      .select()
      .from(inventoryReturnApprovals)
      .where(eq(inventoryReturnApprovals.returnId, returnId));

    return { ...returnRecord, items, approvals };
  }

  // ====== CREDIT NOTES ======

  async getCreditNotes(organizationId: number, filters?: {
    patientId?: number;
    status?: string;
    limit?: number;
  }) {
    const conditions = [eq(inventoryCreditNotes.organizationId, organizationId)];

    if (filters?.patientId) {
      conditions.push(eq(inventoryCreditNotes.patientId, filters.patientId));
    }
    if (filters?.status) {
      conditions.push(eq(inventoryCreditNotes.status, filters.status));
    }

    let query = db
      .select()
      .from(inventoryCreditNotes)
      .where(and(...conditions))
      .orderBy(desc(inventoryCreditNotes.issueDate));

    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }

    return await query;
  }

  async applyCreditNote(creditNoteId: number, organizationId: number, amount: number) {
    const [creditNote] = await db
      .select()
      .from(inventoryCreditNotes)
      .where(and(
        eq(inventoryCreditNotes.id, creditNoteId),
        eq(inventoryCreditNotes.organizationId, organizationId)
      ));

    if (!creditNote) throw new Error('Credit note not found');
    if (creditNote.status !== 'active') throw new Error('Credit note is not active');
    
    const remaining = parseFloat(creditNote.remainingAmount);
    if (amount > remaining) throw new Error(`Cannot apply more than remaining balance of ${remaining}`);

    const newRemaining = remaining - amount;
    const newUsed = parseFloat(creditNote.usedAmount || '0') + amount;

    const [updated] = await db
      .update(inventoryCreditNotes)
      .set({
        usedAmount: newUsed.toString(),
        remainingAmount: newRemaining.toString(),
        status: newRemaining <= 0 ? 'exhausted' : 'active',
        updatedAt: new Date()
      })
      .where(eq(inventoryCreditNotes.id, creditNoteId))
      .returning();

    return updated;
  }

  // ====== STOCK ADJUSTMENTS ======

  async getStockAdjustments(organizationId: number, filters?: {
    adjustmentType?: string;
    itemId?: number;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const conditions = [eq(inventoryStockAdjustments.organizationId, organizationId)];

    if (filters?.adjustmentType) {
      conditions.push(eq(inventoryStockAdjustments.adjustmentType, filters.adjustmentType));
    }
    if (filters?.itemId) {
      conditions.push(eq(inventoryStockAdjustments.itemId, filters.itemId));
    }
    if (filters?.startDate) {
      conditions.push(gte(inventoryStockAdjustments.adjustmentDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(inventoryStockAdjustments.adjustmentDate, filters.endDate));
    }

    let query = db
      .select()
      .from(inventoryStockAdjustments)
      .where(and(...conditions))
      .orderBy(desc(inventoryStockAdjustments.adjustmentDate));

    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }

    return await query;
  }
}

export const inventoryService = new InventoryService();