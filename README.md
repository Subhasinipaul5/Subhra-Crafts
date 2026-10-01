SubhRa Crafts

SubhRa Crafts is a full-stack handmade resin art and jewelry e-commerce website built with React, Vite, Tailwind CSS, Node.js, Express, and MongoDB. It provides a complete shopping experience for customers along with a secure admin dashboard for managing the store.

Features
Storefront: Home, Shop, Product Details, Cart, Wishlist, Checkout, Custom Orders, Reviews, About and Contact
Customer Account: Profile, saved addresses, orders, payments, wishlist and custom orders
Admin Dashboard: Products, Categories, Homepage Sections, Orders, Reviews, Customers, Custom Orders, Payments & Revenue and Settings
Product Management: Categories, variants, stock, pricing, discounts, labels and bestseller management
Homepage Management: Admin can choose and manage the sections, products and banner content displayed on the homepage
Reviews: Customers can submit reviews with photos, with admin approval before they appear publicly
Delivery: Address selection, map-based delivery location and distance-based shipping charges
Order Management: Customers and admins have separate order management and deletion controls
WhatsApp Ordering: Customers can contact the admin through WhatsApp to place/confirm orders
Themes: Multiple customizable website themes with responsive design
Responsive Design: Optimized for desktop, tablet and mobile devices
Image Storage: Cloudinary integration for product and customer-uploaded images
Authentication: Secure customer and admin login with protected routes and role-based access
Technology

Frontend: React, Vite, Tailwind CSS, React Router, Axios
Backend: Node.js, Express, MongoDB, Mongoose, JWT
Storage & Services: MongoDB Atlas, Cloudinary, OpenStreetMap, Leaflet
Development: npm, environment variables, REST APIs

Project Structure
SubhRa-Crafts/
├── frontend/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── pages/
│       ├── pages/admin/
│       └── api/
│
└── backend/
    ├── models/
    ├── controllers/
    ├── routes/
    ├── middleware/
    ├── utils/
    └── server.js
Installation

Install dependencies in both folders:

cd backend
npm install

cd ../frontend
npm install

Create your own .env files using the project's environment-variable examples. Do not commit passwords, API keys, database credentials, or other secrets to GitHub.

Run Locally

Start the backend:

cd backend
npm run dev

Start the frontend in another terminal:

cd frontend
npm run dev

The application can then be opened through the local Vite development URL shown in the terminal.

Important

Before using the application, configure the required MongoDB and Cloudinary environment variables. Keep all private credentials inside .env files and never include real passwords or secret keys in this README.

SubhRa Crafts — Handmade with Love.