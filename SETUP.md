# Inventory POS System - Simplified Setup

## What's Built

A professional **LOGIN + POS** system with **black and white** aesthetic.

### Backend (Node.js + Express)
- `/api/auth/login` - User authentication
- `/api/auth/test` - Connection test
- `/api/pos/products` - Get all products
- `/api/pos/sale` - Create sale transaction

### Frontend
- **Login Screen** - Clean black background, white form
- **Dashboard** - Navigation sidebar + POS interface
- **POS System** - Product selection, cart management, checkout

### Color Scheme
- Background: #1a1a1a (dark gray) for navigation
- Main: #fff (white) for content
- Text: #000 (black) on white, #fff on dark backgrounds
- Accents: #333, #666, #999 (various grays)
- No colors - professional and minimal

### Database Tables Needed
```sql
-- Only these tables are used:
users          -- login credentials
products       -- items for sale
sales          -- sale transactions
sale_items     -- line items in each sale
```

## Project Structure

```
src/front/
├── Login.jsx          -- Login form
├── Login.css          -- Login styling (individual file)
├── Dashboard.jsx      -- Main layout
├── Dashboard.css      -- Dashboard layout (individual file)
├── Navbar.jsx         -- Navigation sidebar
├── Navbar.css         -- Navbar styling (individual file)
├── POS.jsx            -- Point of sale system
└── POS.css            -- POS styling (individual file)

server/
├── server.js          -- Express setup (simplified)
├── routes/
│   ├── auth.js        -- Login endpoint
│   └── pos.js         -- Products & sales endpoints
└── services/
    ├── posService.js  -- POS business logic
    (others deleted)
```

## To Run

1. **Backend:**
   ```bash
   cd ./server
   node server.js
   ```

2. **Frontend:**
   ```bash
   npm run dev
   ```

3. **Test login with:**
   - Username: `staff` (or any user in database)
   - Password: `########`

## Design Features
- Professional black/white/gray palette
- Clean minimalist interface - no gradients, no unnecessary colors
- Individual CSS files per component (not consolidated)
- Responsive layout
- Dark sidebar, light main content area

