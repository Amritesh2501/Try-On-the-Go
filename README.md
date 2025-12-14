# 👗 Try on the Go  
### AI-Powered Virtual Fitting Room

**Try on the Go** is a premium virtual try-on web application powered by AI.  
It enables users to upload a photo, generate a digital twin, and layer outfits in real time — creating a high-fidelity **Digital Atelier** experience that goes far beyond simple AI wrappers.

🚀 **Live Demo:**  
https://try-on-the-go-173324000112.us-west1.run.app/

---

## ✨ Features

- 📸 Photo upload & digital twin generation
- 👕 Real-time outfit layering (Outfit Stack)
- 🔄 Undo / redo garment changes
- 🎨 Advanced editing tools (crop, pose, filters)
- 🧠 AI-powered virtual try-on using Google Gemini
- 🌙 Dark mode with modern UI
- ⚡ Fast, responsive experience (Vite powered)

---

## 🧠 How It Works

1. User uploads a photo
2. AI generates a digital twin
3. Garments are layered using a custom **Outfit Stack system**
4. Users can adjust pose, crop, compare outfits, and fine-tune details
5. Final result is rendered with photorealistic quality

---

## 🛠️ Tech Stack

### Frontend
- React 19
- TypeScript
- Vite
- CSS (custom theming & UI)

### AI
- Google Gemini 2.5 Flash Image Model
- Custom Gemini service wrapper

### State & UX
- Complex outfit layering state management
- Modular component architecture
- Smooth loaders & overlays

### Deployment
- Google Cloud Run

---

## 📁 Project Structure
├── components/
│ ├── ui/
│ │ ├── AddProductModal.tsx
│ │ ├── AdjustmentPanel.tsx
│ │ ├── Canvas.tsx
│ │ ├── CropPanel.tsx
│ │ ├── CurrentOutfitPanel.tsx
│ │ ├── EditorCanvas.tsx
│ │ ├── FilterPanel.tsx
│ │ ├── Header.tsx
│ │ ├── Footer.tsx
│ │ ├── ImageUploader.tsx
│ │ ├── OutfitStack.tsx
│ │ ├── PosePanel.tsx
│ │ ├── ProductSelector.tsx
│ │ ├── ThemeToggle.tsx
│ │ ├── Toolbar.tsx
│ │ ├── WardrobeModal.tsx
│ │ └── WardrobeSheet.tsx
│ ├── icons/
│ └── StartScreen.tsx
│
├── lib/
│ ├── compare.ts
│ └── sparkles.ts
│
├── services/
│ └── geminiService.ts
│
├── src/
│ └── App.tsx
│
├── utils.ts
├── wardrobe.ts
├── index.html
├── index.tsx
├── index.css
├── metadata.json
├── types.ts
├── vite.config.ts
├── tsconfig.json
├── .env.local
└── package.json



---

## 🔑 Environment Variables

Create a `.env.local` file in the root directory:

---

## 🚀 Getting Started

### 1️⃣ Clone the Repository

git clone https://github.com/your-username/try-on-the-go.git

cd try-on-the-go


### 2️⃣ Install Dependencies
npm install


### 3️⃣ Run the App
npm run dev


---

## 🧩 Core Concepts

### 🧠 Outfit Stack
A custom state system enabling:
- Multiple garment layers
- Undo / redo actions
- Smooth UI updates without re-render issues

### 🎨 Editor Canvas
Responsible for:
- Image rendering
- Pose alignment
- Crop & adjustment tools
- Filter application

### 🤖 Gemini AI Service
Located in: services/geminiService.ts

Handles:
- Virtual try-on generation
- Pose variation
- Image enhancement

---

## 🧪 Use Cases

- 👗 Fashion & apparel try-on
- 🛍️ E-commerce visualization
- 🎭 Style experimentation
- 👕 Outfit comparison before purchase

---

## 📈 Future Enhancements

- Video-based try-on
- Saved outfit collections
- Social sharing
- Backend API proxy for key security
- Mobile gesture controls

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create a feature branch
3. Commit your changes
4. Open a pull request

---

## 📄 License

MIT License  
© 2025 – Try on the Go

---

## 💡 Vision

The goal of **Try on the Go** is to move beyond basic AI demos and deliver a **production-ready virtual fitting experience** that feels fast, intuitive, and visually premium.


