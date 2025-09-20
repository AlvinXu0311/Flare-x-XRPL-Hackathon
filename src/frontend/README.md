# XRPL Medical Records Platform - Frontend

This is the frontend application for the XRPL-based autism evaluation sharing platform.

## 🏗️ Architecture

- **Framework**: Vue 3 with Composition API
- **Language**: JavaScript (ES6+)
- **Routing**: Vue Router 4
- **Styling**: Custom CSS with responsive design
- **Build Tool**: Vite
- **Package Manager**: npm

## 🚀 Features

### Patient Portal (`/patient`)
- Secure file upload for ADOS/ADI-R evaluations
- Patient information collection
- File encryption and NFT minting on XRPL
- Upload progress tracking
- Success confirmation with NFT Token ID

### Hospital Portal (`/hospital`)
- Evaluation search functionality
- $15 payment system via XRPL
- Secure file download
- Access history tracking
- Payment modal with XRPL integration

### Home Page (`/`)
- Platform overview
- Portal selection interface
- Feature explanations

## 📦 Dependencies

### Production
- `vue`: Vue.js framework
- `vue-router`: Client-side routing
- `axios`: HTTP client for API calls
- `xrpl`: XRPL blockchain integration
- `@vueuse/core`: Vue utility functions
- `lucide-vue-next`: Icon library

### Development
- `vite`: Build tool and dev server
- `@vitejs/plugin-vue`: Vue plugin for Vite
- `vite-plugin-vue-devtools`: Vue DevTools integration

## 🛠️ Setup & Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

5. **Preview production build**:
   ```bash
   npm run preview
   ```

## 🌐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` |
| `VITE_XRPL_NETWORK` | XRPL network endpoint | `wss://xrplcluster.com/` |
| `VITE_XRPL_TESTNET` | XRPL testnet endpoint | `wss://s.altnet.rippletest.net:51233` |
| `VITE_MAX_FILE_SIZE` | Maximum upload file size | `52428800` (50MB) |
| `VITE_ENABLE_DEMO_MODE` | Enable demo/mock mode | `true` |

## 📁 Project Structure

```
src/
├── views/                 # Page components
│   ├── Home.vue          # Landing page
│   ├── PatientPortal.vue # Patient upload interface
│   └── HospitalPortal.vue# Hospital access interface
├── router/               # Vue Router configuration
│   └── index.js         # Route definitions
├── services/            # API service layer
│   └── api.js          # HTTP client and API methods
├── utils/              # Utility functions
│   └── xrpl.js        # XRPL blockchain utilities
├── App.vue            # Root component
└── main.js           # Application entry point
```

## 🔐 Security Features

- File encryption before storage
- Secure XRPL wallet integration
- NFT-based access control
- Payment verification via Flare FDC
- No traditional authentication required

## 🎨 UI/UX Features

- Responsive design for mobile and desktop
- Intuitive portal-based navigation
- Progress indicators for uploads and payments
- Real-time feedback and error handling
- Accessible color schemes and typography

## 🔧 API Integration

The frontend communicates with the backend through:

- File upload endpoints
- Evaluation search and retrieval
- Payment processing
- XRPL blockchain operations
- Access management

## 📱 Browser Support

- Modern browsers with ES6+ support
- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## 🚀 Deployment

The application can be deployed to any static hosting service:

1. Build the application: `npm run build`
2. Deploy the `dist/` folder to your hosting provider
3. Configure environment variables for your production environment

## 🔄 Development Workflow

1. Make changes to Vue components
2. Test in development server (auto-reload enabled)
3. Verify API integrations work correctly
4. Test responsive design across devices
5. Build and test production bundle

## 🐛 Troubleshooting

### Common Issues

- **Dev server won't start**: Clear Vite cache with `rm -rf node_modules/.vite`
- **API calls failing**: Check `VITE_API_URL` in environment variables
- **XRPL connection issues**: Verify network endpoints and wallet configuration

## 📞 Support

For issues specific to the frontend application, check:
1. Browser console for JavaScript errors
2. Network tab for failed API requests
3. Vue DevTools for component state inspection