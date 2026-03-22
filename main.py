import os
import io
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=str(PROJECT_ROOT / "static")), name="static")
templates = Jinja2Templates(directory=str(PROJECT_ROOT / "templates"))

# --- MODEL LOADING ---
try:
    status_model = joblib.load(PROJECT_ROOT / "student_status_classifier.pkl")
    cgpa_model = joblib.load(PROJECT_ROOT / "student_cgpa_regressor.pkl")
    print("Universal Models loaded successfully!")
except Exception as e:
    print(f"CRITICAL ERROR LOADING MODELS: {e}")

class StudentData(BaseModel):
    name: str
    attendance: float
    midterm_marks: float
    midterm_total: float
    internal_marks: float
    internal_total: float
    study_time: float
    backlogs: int

@app.post("/predict")
async def predict_student(data: StudentData):
    try:
        # Convert to Percentages for the Universal Model
        mid_pct = (data.midterm_marks / data.midterm_total) * 100
        int_pct = (data.internal_marks / data.internal_total) * 100
        att_pct = data.attendance 
        back_score = max(0, (1 - (data.backlogs / 10)) * 100) 
        study_pct = (data.study_time / 12) * 100

        # Sequence: [Mid%, Int%, Att%, Back%, Study%]
        features = np.array([[mid_pct, int_pct, att_pct, back_score, study_pct]])
        
        status_code = status_model.predict(features)[0]
        predicted_cgpa = cgpa_model.predict(features)[0]
        
        return {
            "status": "Strong Learner" if status_code == 1 else "Weak Learner",
            "predicted_cgpa": round(float(predicted_cgpa), 2),
            "summary": f"Analysis for {data.name} completed.",
            "improvement_suggestions": "Maintain consistency." if status_code == 1 else "Increase study hours."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/bulk-predict")
async def bulk_predict(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents)) if file.filename.endswith('.csv') else pd.read_excel(io.BytesIO(contents))
        df.columns = df.columns.str.strip().str.lower()

        results_list = []
        subject_stats = {}
        weak_by_subject = {}
        total_cgpa = 0

        for _, row in df.iterrows():
            name = str(row.get('student name') or row.get('name') or "Unknown")
            subject = str(row.get('subject') or "General")
            
            # Normalization
            mid_pct = (float(row.get('midterm marks', 0)) / float(row.get('midterm total', 1))) * 100
            int_pct = (float(row.get('internal marks', 0)) / float(row.get('internal total', 1))) * 100
            back_score = max(0, (1 - (int(row.get('backlogs', 0)) / 10)) * 100)
            study_pct = (float(row.get('study time', 0)) / 12) * 100
            att = float(row.get('attendance', 0))

            features = np.array([[mid_pct, int_pct, att, back_score, study_pct]])
            s_code = status_model.predict(features)[0]
            p_cgpa = round(float(cgpa_model.predict(features)[0]), 2)
            total_cgpa += p_cgpa
            
            status_text = "STRONG LEARNER" if s_code == 1 else "WEAK LEARNER"

            # Add to table list
            results_list.append({
                "name": name,
                "subject": subject,
                "status": status_text,
                "grade": p_cgpa
            })

            # Track subject performance
            if subject not in subject_stats:
                subject_stats[subject] = {"total": 0, "passed": 0}
                weak_by_subject[subject] = []
            
            subject_stats[subject]["total"] += 1
            if s_code == 1:
                subject_stats[subject]["passed"] += 1
            else:
                weak_by_subject[subject].append(name)

        avg_grade = round(total_cgpa / len(df), 2) if len(df) > 0 else 0
        
        # Format subject performance strings
        subject_perf = [f"• <strong>{sub}</strong>: {round((v['passed']/v['total'])*100)}% Success ({v['passed']}/{v['total']})" 
                        for sub, v in subject_stats.items()]

        return {
            "table_data": results_list,
            "summary": {
                "avg_grade": avg_grade,
                "total_students": len(df),
                "subject_performance": subject_perf
            },
            "strategy": {
                "priority_subject": min(subject_stats, key=lambda x: subject_stats[x]['passed']/subject_stats[x]['total']),
                "weak_learners": {k: ", ".join(v) for k, v in weak_by_subject.items() if v}
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))