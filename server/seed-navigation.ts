/**
 * Navigation Seeding Module
 * 
 * Seeds all navigation-related data on server startup:
 * - Navigation categories
 * - Navigation items  
 * - Item-to-category mappings
 * - Role permissions
 * 
 * This runs automatically on every server start and is idempotent.
 */

import { db } from './db';
import { 
  navigationPermissions, 
  navigationCategories, 
  navigationItemCategories, 
  roleNavigationPermissions,
  userCategoryPreferences
} from '../shared/schema';
import { eq, notInArray, sql } from 'drizzle-orm';

export async function seedNavigation() {
  console.log('🌱 Seeding/Updating Navigation System...');

  try {
    const categories = [
      { categoryKey: 'main', categoryName: 'Financial Control Center', iconName: 'BarChart3', isCollapsible: false, defaultExpanded: true, defaultSortOrder: 1 },
      { categoryKey: 'contract-intelligence', categoryName: 'Contract Intelligence', iconName: 'FileSearch', isCollapsible: true, defaultExpanded: true, defaultSortOrder: 2 },
      { categoryKey: 'contract-execution', categoryName: 'Contract Execution', iconName: 'PlayCircle', isCollapsible: true, defaultExpanded: true, defaultSortOrder: 3 },
      { categoryKey: 'finance-hub', categoryName: 'Finance Hub', iconName: 'Landmark', isCollapsible: true, defaultExpanded: false, defaultSortOrder: 4 },
      { categoryKey: 'financial-intelligence', categoryName: 'Financial Intelligence', iconName: 'LineChart', isCollapsible: true, defaultExpanded: false, defaultSortOrder: 5 },
      { categoryKey: 'financial-data-layer', categoryName: 'Financial Data Layer', iconName: 'Layers', isCollapsible: true, defaultExpanded: false, defaultSortOrder: 6 },
      { categoryKey: 'system-admin', categoryName: 'System Administration', iconName: 'Wrench', isCollapsible: true, defaultExpanded: false, defaultSortOrder: 7 },
      { categoryKey: 'advanced-ai', categoryName: 'Advanced AI', iconName: 'BrainCircuit', isCollapsible: true, defaultExpanded: false, defaultSortOrder: 8 },
    ];

    const activeCategoryKeys = categories.map(c => c.categoryKey);

    for (const cat of categories) {
      await db.insert(navigationCategories).values({
        categoryKey: cat.categoryKey,
        categoryName: cat.categoryName,
        iconName: cat.iconName,
        isCollapsible: cat.isCollapsible,
        defaultExpanded: cat.defaultExpanded,
        defaultSortOrder: cat.defaultSortOrder,
        isActive: true,
      }).onConflictDoUpdate({
        target: navigationCategories.categoryKey,
        set: {
          categoryName: cat.categoryName,
          iconName: cat.iconName,
          isCollapsible: cat.isCollapsible,
          defaultExpanded: cat.defaultExpanded,
          defaultSortOrder: cat.defaultSortOrder,
          isActive: true,
          updatedAt: new Date(),
        }
      });
    }

    await db.update(navigationCategories)
      .set({ isActive: false, updatedAt: new Date() })
      .where(notInArray(navigationCategories.categoryKey, activeCategoryKeys));

    const allRoles = ['viewer', 'editor', 'analyst', 'auditor', 'accountant', 'manager', 'admin', 'owner'];

    const navItems = [
      // Group 1: Financial Control Center
      { itemKey: 'financial-control-center', itemName: 'Financial Control', href: '/financial-control-center', iconName: 'LayoutDashboard', defaultRoles: allRoles, sortOrder: 1 },

      // Group 2: Contract Intelligence
      { itemKey: 'contracts', itemName: 'Search, View, Manage Contracts', href: '/contracts', iconName: 'FileText', defaultRoles: allRoles, sortOrder: 1 },
      { itemKey: 'contracts-ingest', itemName: 'Ingest', href: '/contracts/ingest', iconName: 'Upload', defaultRoles: ['editor', 'manager', 'admin', 'owner'], sortOrder: 2 },
      { itemKey: 'contracts-inbox', itemName: 'Inbox', href: '/contracts/inbox', iconName: 'Inbox', defaultRoles: ['viewer', 'editor', 'analyst', 'auditor', 'accountant', 'manager', 'admin', 'owner'], sortOrder: 3 },
      { itemKey: 'templates', itemName: 'Template Library', href: '/templates', iconName: 'Library', defaultRoles: ['viewer', 'editor', 'analyst', 'auditor', 'accountant', 'manager', 'admin', 'owner'], sortOrder: 6 },
      // Group 3: Contract Execution
      { itemKey: 'sales-data', itemName: 'Data Ingestion', href: '/sales-upload?tab=ingest', iconName: 'Download', defaultRoles: ['analyst', 'auditor', 'accountant', 'manager', 'admin', 'owner'], sortOrder: 1 },
      { itemKey: 'calculations', itemName: 'Calculate', href: '/sales-upload?tab=calculate', iconName: 'Calculator', defaultRoles: ['analyst', 'auditor', 'accountant', 'manager', 'admin', 'owner'], sortOrder: 2 },
      { itemKey: 'execution-log', itemName: 'Execution Log', href: '/sales-upload?tab=log', iconName: 'Clock', defaultRoles: ['analyst', 'auditor', 'accountant', 'manager', 'admin', 'owner'], sortOrder: 3 },
      { itemKey: 'explain', itemName: 'Explain', href: '/sales-upload?tab=explain', iconName: 'MessageSquareText', defaultRoles: ['analyst', 'auditor', 'accountant', 'manager', 'admin', 'owner'], sortOrder: 4 },

      // Group 4: Finance Hub
      { itemKey: 'accrual-management', itemName: 'Accrual Management', href: '/accrual-management', iconName: 'BookOpen', defaultRoles: ['accountant', 'manager', 'admin', 'owner'], sortOrder: 1 },
      { itemKey: 'outstanding-obligations', itemName: 'Outstanding Obligations', href: '/outstanding-obligations', iconName: 'Hourglass', defaultRoles: ['accountant', 'manager', 'admin', 'owner'], sortOrder: 2 },
      { itemKey: 'journal-entry-hub', itemName: 'Journal Entry Hub', href: '/journal-entry-hub', iconName: 'BookMarked', defaultRoles: ['accountant', 'manager', 'admin', 'owner'], sortOrder: 3 },
      { itemKey: 'period-close-workspace', itemName: 'Period Close Workspace', href: '/period-close-workspace', iconName: 'CalendarCheck', defaultRoles: ['accountant', 'manager', 'admin', 'owner'], sortOrder: 4 },
      { itemKey: 'settlement-workspace', itemName: 'Settlement', href: '/settlement-workspace', iconName: 'Handshake', defaultRoles: ['accountant', 'admin', 'owner'], sortOrder: 5 },
      { itemKey: 'claims-workspace', itemName: 'Claims Workspace', href: '/claims-workspace', iconName: 'Scale', defaultRoles: ['accountant', 'manager', 'admin', 'owner'], sortOrder: 6 },
      { itemKey: 'invoices-memos', itemName: 'Invoices & Memos', href: '/invoices-memos', iconName: 'Receipt', defaultRoles: ['accountant', 'manager', 'admin', 'owner'], sortOrder: 7 },
      { itemKey: 'deductions-workspace', itemName: 'Deductions', href: '/deductions-workspace', iconName: 'Scissors', defaultRoles: ['accountant', 'manager', 'admin', 'owner'], sortOrder: 8 },

      // Group 5: Financial Intelligence
      { itemKey: 'analytics', itemName: 'Analytics', href: '/analytics', iconName: 'TrendingUp', defaultRoles: ['analyst', 'admin', 'owner'], sortOrder: 1 },
      { itemKey: 'reports', itemName: 'Reports', href: '/reports', iconName: 'ClipboardList', defaultRoles: ['analyst', 'admin', 'owner'], sortOrder: 2 },

      // Group 6: Financial Data Layer

      // Group 7: System Administration
      { itemKey: 'master-data', itemName: 'Enterprise Master', href: '/master-data', iconName: 'Database', defaultRoles: ['admin', 'owner'], sortOrder: 1 },
      { itemKey: 'company-settings', itemName: 'Enterprise Configuration', href: '/company-settings', iconName: 'Building2', defaultRoles: ['admin', 'owner'], sortOrder: 2 },
      { itemKey: 'user-management', itemName: 'User Management', href: '/users', iconName: 'Users', defaultRoles: ['admin', 'owner'], sortOrder: 3 },
      { itemKey: 'configuration', itemName: 'Access and Role Management', href: '/configuration', iconName: 'Shield', defaultRoles: ['admin', 'owner'], sortOrder: 4 },
      { itemKey: 'erp-hub', itemName: 'Integrations', href: '/erp-hub', iconName: 'Plug', defaultRoles: ['admin', 'owner'], sortOrder: 5 },
      { itemKey: 'licenseiq-catalog', itemName: 'Enterprise Data Management', href: '/licenseiq-schema', iconName: 'Table', defaultRoles: ['admin', 'owner'], sortOrder: 6 },
      { itemKey: 'lead-management', itemName: 'Lead Management', href: '/admin/leads', iconName: 'UserPlus', defaultRoles: ['admin', 'owner'], sortOrder: 7 },
      { itemKey: 'email-templates', itemName: 'Email Templates', href: '/admin/email-templates', iconName: 'Mail', defaultRoles: ['admin', 'owner'], sortOrder: 8 },
      { itemKey: 'navigation-manager', itemName: 'Navigation Manager', href: '/navigation-manager', iconName: 'LayoutGrid', defaultRoles: ['owner'], sortOrder: 9 },
      { itemKey: 'audit-trail', itemName: 'Audit Trail', href: '/audit', iconName: 'History', defaultRoles: ['auditor', 'accountant', 'admin', 'owner'], sortOrder: 10 },
      { itemKey: 'sql-console', itemName: 'SQL Console', href: '/admin/sql-console', iconName: 'Terminal', defaultRoles: ['admin', 'owner'], sortOrder: 11 },
      { itemKey: 'blog-management', itemName: 'Blog Management', href: '/admin/blogs', iconName: 'PenSquare', defaultRoles: ['admin', 'owner'], sortOrder: 12 },
      { itemKey: 'system-settings', itemName: 'System Settings', href: '/system-settings', iconName: 'Settings', defaultRoles: ['admin', 'owner'], sortOrder: 13 },
      { itemKey: 'obligation-canonical-audit', itemName: 'Canonical Fields Audit', href: '/admin/obligation-canonical-audit', iconName: 'ShieldCheck', defaultRoles: ['manager', 'admin', 'owner'], sortOrder: 14 },

      // Group 8: Advanced AI
      { itemKey: 'knowledge-base', itemName: 'Knowledge Base', href: '/knowledge-base', iconName: 'Library', defaultRoles: ['admin', 'owner'], sortOrder: 1 },
      { itemKey: 'rag-dashboard', itemName: 'RAG Management', href: '/rag-dashboard', iconName: 'Sparkles', defaultRoles: ['admin', 'owner'], sortOrder: 2 },
    ];

    const activeItemKeys = navItems.map(i => i.itemKey);

    for (const item of navItems) {
      await db.insert(navigationPermissions).values({
        itemKey: item.itemKey,
        itemName: item.itemName,
        href: item.href,
        iconName: item.iconName,
        defaultRoles: item.defaultRoles,
        sortOrder: item.sortOrder,
        isActive: true,
      }).onConflictDoUpdate({
        target: navigationPermissions.itemKey,
        set: {
          itemName: item.itemName,
          href: item.href,
          iconName: item.iconName,
          defaultRoles: item.defaultRoles,
          sortOrder: item.sortOrder,
          isActive: true,
          updatedAt: new Date(),
        }
      });
    }

    await db.update(navigationPermissions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(notInArray(navigationPermissions.itemKey, activeItemKeys));

    const itemCategoryMappings = [
      // Group 1: Financial Control Center
      { navItemKey: 'financial-control-center', categoryKey: 'main', sortOrder: 1 },

      // Group 2: Contract Intelligence
      { navItemKey: 'contracts', categoryKey: 'contract-intelligence', sortOrder: 1 },
      { navItemKey: 'contracts-ingest', categoryKey: 'contract-intelligence', sortOrder: 2 },
      { navItemKey: 'contracts-inbox', categoryKey: 'contract-intelligence', sortOrder: 3 },
      { navItemKey: 'templates', categoryKey: 'contract-intelligence', sortOrder: 6 },
      // Group 3: Contract Execution
      { navItemKey: 'sales-data', categoryKey: 'contract-execution', sortOrder: 1 },
      { navItemKey: 'calculations', categoryKey: 'contract-execution', sortOrder: 2 },
      { navItemKey: 'execution-log', categoryKey: 'contract-execution', sortOrder: 3 },
      { navItemKey: 'explain', categoryKey: 'contract-execution', sortOrder: 4 },

      // Group 4: Finance Hub
      { navItemKey: 'accrual-management', categoryKey: 'finance-hub', sortOrder: 1 },
      { navItemKey: 'outstanding-obligations', categoryKey: 'finance-hub', sortOrder: 2 },
      { navItemKey: 'journal-entry-hub', categoryKey: 'finance-hub', sortOrder: 3 },
      { navItemKey: 'period-close-workspace', categoryKey: 'finance-hub', sortOrder: 4 },
      { navItemKey: 'settlement-workspace', categoryKey: 'finance-hub', sortOrder: 5 },
      { navItemKey: 'claims-workspace', categoryKey: 'finance-hub', sortOrder: 6 },
      { navItemKey: 'invoices-memos', categoryKey: 'finance-hub', sortOrder: 7 },
      { navItemKey: 'deductions-workspace', categoryKey: 'finance-hub', sortOrder: 8 },

      // Group 5: Financial Intelligence
      { navItemKey: 'analytics', categoryKey: 'financial-intelligence', sortOrder: 1 },
      { navItemKey: 'reports', categoryKey: 'financial-intelligence', sortOrder: 2 },

      // Group 6: Financial Data Layer
      { navItemKey: 'licenseiq-catalog', categoryKey: 'financial-data-layer', sortOrder: 1 },

      // Group 7: System Administration
      { navItemKey: 'master-data', categoryKey: 'system-admin', sortOrder: 1 },
      { navItemKey: 'company-settings', categoryKey: 'system-admin', sortOrder: 2 },
      { navItemKey: 'user-management', categoryKey: 'system-admin', sortOrder: 3 },
      { navItemKey: 'configuration', categoryKey: 'system-admin', sortOrder: 4 },
      { navItemKey: 'erp-hub', categoryKey: 'system-admin', sortOrder: 5 },
      { navItemKey: 'lead-management', categoryKey: 'system-admin', sortOrder: 6 },
      { navItemKey: 'email-templates', categoryKey: 'system-admin', sortOrder: 7 },
      { navItemKey: 'navigation-manager', categoryKey: 'system-admin', sortOrder: 8 },
      { navItemKey: 'audit-trail', categoryKey: 'system-admin', sortOrder: 9 },
      { navItemKey: 'sql-console', categoryKey: 'system-admin', sortOrder: 10 },
      { navItemKey: 'blog-management', categoryKey: 'system-admin', sortOrder: 11 },
      { navItemKey: 'obligation-canonical-audit', categoryKey: 'system-admin', sortOrder: 12 },

      // Group 8: Advanced AI
      { navItemKey: 'knowledge-base', categoryKey: 'advanced-ai', sortOrder: 1 },
      { navItemKey: 'rag-dashboard', categoryKey: 'advanced-ai', sortOrder: 2 },
      { navItemKey: 'system-settings', categoryKey: 'advanced-ai', sortOrder: 3 },
    ];

    for (const mapping of itemCategoryMappings) {
      const existing = await db.select()
        .from(navigationItemCategories)
        .where(eq(navigationItemCategories.navItemKey, mapping.navItemKey))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(navigationItemCategories)
          .set({
            categoryKey: mapping.categoryKey,
            sortOrder: mapping.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(navigationItemCategories.navItemKey, mapping.navItemKey));
      } else {
        await db.insert(navigationItemCategories).values({
          navItemKey: mapping.navItemKey,
          categoryKey: mapping.categoryKey,
          sortOrder: mapping.sortOrder,
        });
      }
    }

    await db.delete(roleNavigationPermissions);
    const permValues: { role: string; navItemKey: string; isEnabled: boolean }[] = [];
    for (const item of navItems) {
      for (const role of allRoles) {
        permValues.push({
          role,
          navItemKey: item.itemKey,
          isEnabled: item.defaultRoles.includes(role),
        });
      }
    }
    if (permValues.length > 0) {
      await db.insert(roleNavigationPermissions).values(permValues);
    }

    // Build mapping from navItemKey → new categoryKey for user preference migration
    const newCategoryMap = new Map(itemCategoryMappings.map(m => [m.navItemKey, m.categoryKey]));

    // Update user category preferences to match new category keys
    const allUserPrefs = await db.select().from(userCategoryPreferences);
    for (const pref of allUserPrefs) {
      const newCategoryKey = newCategoryMap.get(pref.navItemKey);
      if (newCategoryKey && pref.categoryKey !== newCategoryKey) {
        await db.update(userCategoryPreferences)
          .set({ categoryKey: newCategoryKey, updatedAt: new Date() })
          .where(eq(userCategoryPreferences.id, pref.id));
      } else if (!newCategoryKey) {
        await db.delete(userCategoryPreferences)
          .where(eq(userCategoryPreferences.id, pref.id));
      }
    }

    console.log(`✅ Navigation seeding complete: ${categories.length} categories, ${navItems.length} items, ${itemCategoryMappings.length} mappings`);

  } catch (error: any) {
    console.error('⚠ Navigation seeding warning:', error.message);
  }
}
