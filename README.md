# MedInsure AI - Medical Insurance Premium Predictor

A modern web application that predicts medical insurance premiums using machine learning, with interactive data analysis and health tips.

## 🏥 Features

- **AI-Powered Predictions**: Instant premium estimates using trained ML model
- **Interactive Analysis**: Charts and insights from insurance dataset
- **Health Tips**: Personalized wellness recommendations
- **Modern UI**: Medical-themed design with smooth animations
- **Responsive**: Works on desktop and mobile devices

## 📁 Project Structure

```
Medical_insurance/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   └── train.py         # Model training script
│   ├── models/              # Trained model artifacts
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── assets/
│   │   ├── style.css        # Medical-themed styling
│   │   ├── main.js          # Shared utilities
│   │   ├── predict.js       # Prediction logic
│   │   ├── analysis.js      # Charts and analysis
│   │   └── tips.js          # Dynamic health tips
│   ├── index.html           # Home page
│   ├── predict.html         # Prediction form
│   ├── analysis.html        # Data visualizations
│   └── tips.html            # Health tips
├── notebooks/               # Jupyter notebooks for EDA
└── insurance.csv            # Dataset (1,338 records)
```

## 🚀 Setup & Installation

### Prerequisites
- Python 3.8+ 
- Web browser

### 1. Backend Setup

```powershell
# Navigate to project directory
cd "C:\Users\Abhijeet Khade\programs\Sem5_Projects\Medical_insurance"

# Create virtual environment
py -m venv backend\.venv

# Activate virtual environment
backend\.venv\Scripts\activate

# Install dependencies
pip install -r backend\requirements.txt

# Train the model (first time only)
cd backend
python app\train.py
```

### 2. Frontend Setup

No additional setup required - uses vanilla HTML/CSS/JavaScript.

## 🏃‍♂️ Running the Application

### Start Backend Server

```powershell
# From project root
cd backend
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Start Frontend Server

```powershell
# From project root (new terminal)
py -m http.server 5173 -d .
```

## 🌐 Access the Application

Once both servers are running:

- **Home**: http://127.0.0.1:5173/frontend/index.html
- **Predict**: http://127.0.0.1:5173/frontend/predict.html
- **Analysis**: http://127.0.0.1:5173/frontend/analysis.html
- **Tips**: http://127.0.0.1:5173/frontend/tips.html
- **API Docs**: http://127.0.0.1:8000/docs

## 🔧 API Endpoints

- `GET /health` - Server health check
- `POST /predict` - Insurance premium prediction
- `GET /analysis/summary` - Dataset statistics
- `GET /analysis/distributions` - Data distributions
- `GET /analysis/grouped` - Grouped analysis
- `GET /dataset/sample` - Dataset samples

## 📊 Model Details

- **Algorithm**: Gradient Boosting Regressor
- **Features**: Age, Sex, BMI, Children, Smoker, Region
- **Target**: Insurance Charges (USD)
- **Performance**: R² ≈ 0.879, MAE ≈ $2,405
- **Preprocessing**: Standard scaling + One-hot encoding

## 🎨 UI Theme

- **Colors**: Medical Blue (#2B8EFF), Teal (#00BFA5), Clean White
- **Typography**: Poppins font family
- **Design**: Glass-morphism cards, gradient buttons, smooth animations
- **Responsive**: Mobile-friendly layout

## 🔍 Usage Examples

### Making a Prediction
1. Go to Predict page
2. Fill form: Age=30, Sex=Male, BMI=25, Children=1, Smoker=No, Region=Southeast
3. Click "Predict Premium"
4. View animated result in INR

### Viewing Analysis
1. Go to Analysis page
2. See KPIs, charts, and distributions
3. All data sourced from insurance.csv

## 🛠 Troubleshooting

**Charts not showing:**
- Check browser console (F12) for errors
- Ensure backend is running on port 8000
- Hard refresh (Ctrl+F5)

**High predictions:**
- Model trained on US insurance data (~$1k-$50k range)
- Frontend converts to INR and scales appropriately

**Backend issues:**
- Check if model.joblib exists in backend/models/
- Re-run training: `python app\train.py`
- Verify dataset at project root: insurance.csv

## 📄 License

Educational project for medical insurance premium prediction.

---

Made with ❤️ for healthcare analytics