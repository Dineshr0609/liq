# 🧪 Multi-Location Context Filtering - Test Scenarios

## 📋 Test Overview

This document provides step-by-step testing scenarios to verify the multi-location context filtering system works correctly. Each test user has different organizational access levels and should see filtered data accordingly.

---

## 🔑 Test User Credentials

| Username | Password | Company | Business Unit | Location | Role | Access Level |
|----------|----------|---------|---------------|----------|------|--------------|
| **alice.test** | Test@123! | Acme Corporation | Sales Division | NY Office | editor | Location-only |
| **bob.test** | Test@123! | Acme Corporation | Sales Division | LA Office | editor | Location-only |
| **charlie.test** | Test@123! | Acme Corporation | Sales Division | _(All locations)_ | manager | Business Unit |
| **diana.test** | Test@123! | Acme Corporation | _(All BUs)_ | _(All locations)_ | owner | Company-wide |
| **admin** | Admin@123! | _(System)_ | _(All)_ | _(All)_ | admin | Global bypass |

---

## 🎯 Test Scenario 1: Location-Level Access (Alice)

### 👤 User: **alice.test**
**Access Level:** Location (NY Office only)

### Steps:

1. **Login**
   ```
   Username: alice.test
   Password: Test@123!
   ```

2. **Check Header Context Switcher**
   - Look at the top-right of the navigation header
   - Should display: **📍 Acme Corporation → Sales Division → NY Office [editor] ▼**
   - This shows Alice's current active context

3. **Navigate to Contracts Page**
   - Click on "Contracts" in the left sidebar
   - **Expected Result:** Should see **ONLY 1 contract**
     - ✅ "NY Office Software License" (uploaded by Alice)
   - Should **NOT** see:
     - ❌ LA Office Distribution Agreement (Bob's contract)
     - ❌ Frisco Partnership Agreement (Rao Group)

4. **Check Sales Data**
   - Click on the NY contract to view details
   - Click "Sales Data" tab
   - **Expected Result:** Should see **2 sales records**
     - ✅ NY-TXN-001: Enterprise Software Suite ($50,000)
     - ✅ NY-TXN-002: Professional Services ($30,000)

5. **Check License Fee Calculations**
   - Navigate to "License Fee Calculator" or "Calculations"
   - **Expected Result:** Should see **1 calculation**
     - ✅ Q1 2024 License Fees - NY Office (Approved)

### ✅ Success Criteria:
- ✅ Sees only 1 contract (NY Office)
- ✅ Sees 2 sales records (NY only)
- ✅ Sees 1 calculation (NY only)
- ✅ Context switcher shows: "Acme → Sales → NY Office [editor]"

---

## 🎯 Test Scenario 2: Location-Level Access (Bob)

### 👤 User: **bob.test**
**Access Level:** Location (LA Office only)

### Steps:

1. **Logout from Alice's account**
   - Click logout button

2. **Login as Bob**
   ```
   Username: bob.test
   Password: Test@123!
   ```

3. **Check Header Context Switcher**
   - Should display: **📍 Acme Corporation → Sales Division → LA Office [editor] ▼**

4. **Navigate to Contracts Page**
   - **Expected Result:** Should see **ONLY 1 contract**
     - ✅ "LA Office Distribution Agreement" (uploaded by Bob)
   - Should **NOT** see:
     - ❌ NY Office Software License (Alice's contract)
     - ❌ Frisco Partnership Agreement (Rao Group)

5. **Check Sales Data**
   - Click on the LA contract
   - **Expected Result:** Should see **1 sales record**
     - ✅ LA-TXN-001: Cloud Platform Subscription ($75,000)

6. **Check License Fee Calculations**
   - **Expected Result:** Should see **1 calculation**
     - ✅ Q1 2024 License Fees - LA Office (Pending Approval)

### ✅ Success Criteria:
- ✅ Sees only 1 contract (LA Office)
- ✅ Sees 1 sales record (LA only)
- ✅ Sees 1 calculation (LA only)
- ✅ Context switcher shows: "Acme → Sales → LA Office [editor]"
- ✅ Completely different data from Alice (no overlap)

---

## 🎯 Test Scenario 3: Business Unit-Level Access (Charlie)

### 👤 User: **charlie.test**
**Access Level:** Business Unit (Sales Division - sees all locations within Sales)

### Steps:

1. **Logout from Bob's account**

2. **Login as Charlie**
   ```
   Username: charlie.test
   Password: Test@123!
   ```

3. **Check Header Context Switcher**
   - Should display: **📍 Acme Corporation → Sales Division [manager] ▼**
   - Note: No specific location shown (has access to all locations in Sales Division)

4. **Navigate to Contracts Page**
   - **Expected Result:** Should see **2 contracts**
     - ✅ "NY Office Software License" (Alice's contract)
     - ✅ "LA Office Distribution Agreement" (Bob's contract)
   - Should **NOT** see:
     - ❌ Frisco Partnership Agreement (different company - Rao Group)

5. **Check Sales Data**
   - **Expected Result:** Should see **3 sales records total**
     - ✅ 2 sales from NY contract
     - ✅ 1 sale from LA contract

6. **Check License Fee Calculations**
   - **Expected Result:** Should see **2 calculations**
     - ✅ Q1 2024 License Fees - NY Office
     - ✅ Q1 2024 License Fees - LA Office

### ✅ Success Criteria:
- ✅ Sees 2 contracts (NY + LA)
- ✅ Sees 3 sales records (NY + LA combined)
- ✅ Sees 2 calculations (NY + LA)
- ✅ Context switcher shows: "Acme → Sales Division [manager]"
- ✅ Sees MORE data than Alice or Bob individually

---

## 🎯 Test Scenario 4: Company-Level Access (Diana)

### 👤 User: **diana.test**
**Access Level:** Company (Acme Corporation - sees all business units and locations within Acme)

### Steps:

1. **Logout from Charlie's account**

2. **Login as Diana**
   ```
   Username: diana.test
   Password: Test@123!
   ```

3. **Check Header Context Switcher**
   - Should display: **📍 Acme Corporation [owner] ▼**
   - Note: No business unit or location shown (has access to entire company)

4. **Navigate to Contracts Page**
   - **Expected Result:** Should see **2 contracts** (same as Charlie)
     - ✅ "NY Office Software License"
     - ✅ "LA Office Distribution Agreement"
   - Should **NOT** see:
     - ❌ Frisco Partnership Agreement (different company - Rao Group)
   - **Why only 2?** Diana has Acme Corporation access, not Rao Group access

5. **Check Sales Data**
   - **Expected Result:** Should see **3 sales records** (same as Charlie)

6. **Check License Fee Calculations**
   - **Expected Result:** Should see **2 calculations** (same as Charlie)

### ✅ Success Criteria:
- ✅ Sees 2 contracts (all Acme contracts)
- ✅ Sees 3 sales records (all Acme sales)
- ✅ Sees 2 calculations (all Acme calculations)
- ✅ Context switcher shows: "Acme Corporation [owner]"
- ✅ Does NOT see Rao Group data

---

## 🎯 Test Scenario 5: Admin Global Access (Admin)

### 👤 User: **admin**
**Access Level:** System Admin (bypasses ALL filtering)

### Steps:

1. **Logout from Diana's account**

2. **Login as Admin**
   ```
   Username: admin
   Password: Admin@123!
   ```

3. **Check Header Context Switcher**
   - **Expected Result:** Context switcher should **NOT appear**
   - Admins bypass organizational filtering, so no context needed

4. **Navigate to Contracts Page**
   - **Expected Result:** Should see **ALL contracts**
     - ✅ "NY Office Software License" (Acme - Sales - NY)
     - ✅ "LA Office Distribution Agreement" (Acme - Sales - LA)
     - ✅ "Frisco Partnership Agreement" (Rao Group - Dallas - Frisco)
     - ✅ Plus any other existing contracts in the database

5. **Check Sales Data**
   - **Expected Result:** Should see **ALL sales records** across all companies

6. **Check License Fee Calculations**
   - **Expected Result:** Should see **ALL calculations** across all companies

### ✅ Success Criteria:
- ✅ Sees ALL contracts (3+ test contracts)
- ✅ Sees ALL sales records
- ✅ Sees ALL calculations
- ✅ NO context switcher shown (admin bypass)
- ✅ Complete visibility across all organizations

---

## 🔄 Test Scenario 6: Context Switching

### 👤 User: **alice.test** (or any user with multiple org assignments)

**Note:** Our test users only have 1 context each, but if Alice had multiple locations, here's how switching would work:

### Steps for Future Testing:

1. **Login as a user with 2+ locations**

2. **Click Context Switcher Button**
   - Look for the **📍 [Current Context] ▼** button in the header
   - Click it to open the dropdown

3. **View Available Contexts**
   - Should see a list of all locations/BUs/companies assigned to this user
   - Active context is highlighted with **● Active** label

4. **Select Different Context**
   - Click on any other context in the list
   - Should see toast notification: "Context Switched"
   - Page will auto-refresh

5. **Verify Data Changes**
   - Navigate to Contracts page
   - **Expected Result:** Data should now be filtered to new context
   - All pages (Contracts, Sales, Calculations) should update

### ✅ Success Criteria:
- ✅ Dropdown shows all available contexts
- ✅ Current context is highlighted
- ✅ Switching triggers page refresh
- ✅ All data updates to new context
- ✅ Header button updates to show new context

---

## 📊 Expected Data Summary

| User | Contracts Visible | Sales Records | Calculations |
|------|-------------------|---------------|--------------|
| **alice.test** | 1 (NY only) | 2 | 1 |
| **bob.test** | 1 (LA only) | 1 | 1 |
| **charlie.test** | 2 (NY + LA) | 3 | 2 |
| **diana.test** | 2 (Acme only) | 3 | 2 |
| **admin** | ALL (3+) | ALL | ALL |

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: Context Switcher Not Showing
**Cause:** User only has 1 organizational assignment  
**Expected Behavior:** Context switcher only appears if user has 2+ contexts  
**Solution:** This is correct behavior, not a bug

### Issue 2: Seeing Too Much Data
**Cause:** User might be logged in as admin or have higher-level access  
**Solution:** Verify you're logged in with the correct test user credentials

### Issue 3: Seeing Too Little Data
**Cause:** Context filter is working correctly  
**Solution:** Verify the expected data count matches the table above

### Issue 4: Context Switcher Shows Wrong Location
**Cause:** Previous session context persisted  
**Solution:** Logout and login again to reset active context

### Issue 5: Data Doesn't Update After Switching
**Cause:** Page didn't refresh  
**Solution:** Manually refresh the page if auto-refresh fails

---

## ✅ Final Validation Checklist

- [ ] Alice sees only NY data (1 contract, 2 sales, 1 calc)
- [ ] Bob sees only LA data (1 contract, 1 sale, 1 calc)
- [ ] Charlie sees Sales Division data (2 contracts, 3 sales, 2 calcs)
- [ ] Diana sees Acme Corporation data (2 contracts, 3 sales, 2 calcs)
- [ ] Admin sees ALL data (bypasses filtering)
- [ ] Context switcher appears in header for all non-admin users
- [ ] Context switcher correctly displays current context
- [ ] No cross-contamination of data between users
- [ ] Context switching works smoothly (when user has multiple contexts)

---

## 📞 Support

If any test fails or shows unexpected results:
1. Check browser console for errors
2. Verify you're using the correct credentials
3. Ensure test data was created successfully
4. Try logging out and back in
5. Clear browser cache if issues persist

---

**Test Date:** _____________  
**Tested By:** _____________  
**Status:** ⬜ Pass ⬜ Fail  
**Notes:** _________________________________
