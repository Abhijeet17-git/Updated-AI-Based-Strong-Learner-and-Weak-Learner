import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib

# 1. Load Data
df_mat = pd.read_csv('student-mat.csv', sep=';')
df_por = pd.read_csv('student-por.csv', sep=';')
df = pd.concat([df_mat, df_por]).drop_duplicates()

# 2. UNIVERSAL SCALING (Converting to 0-100% or 0-1 Scale)
# Marks: UCI (0-20) -> Percentage (0-100)
df['Midterm_PCT'] = (df['G1'] / 20) * 100
df['Internal_PCT'] = (df['G2'] / 20) * 100

# Attendance: absences (0 to max) -> Attendance Percentage (0-100)
# Formula: ((Max_Absences - Actual_Absences) / Max_Absences) * 100
max_abs = df['absences'].max()
df['Attendance_PCT'] = ((max_abs - df['absences']) / max_abs) * 100

# Backlogs: failures (0 to 3) -> Backlog Percentage (0-100)
# 0 failures = 100% (Clean), 3 failures = 0% (High risk)
df['Backlog_Score'] = ((3 - df['failures']) / 3) * 100

# Study Time: studytime (1 to 4) -> Study Efficiency Percentage (0-100)
# 1 = 25%, 2 = 50%, 3 = 75%, 4 = 100%
df['StudyTime_PCT'] = (df['studytime'] / 4) * 100

# 3. Define Features and Targets
features = ['Midterm_PCT', 'Internal_PCT', 'Attendance_PCT', 'Backlog_Score', 'StudyTime_PCT']
X = df[features]

# Universal Target: CGPA scaled to 10.0
df['Universal_CGPA'] = (df['G3'] / 20) * 10

# Status: Strong (1) if they score 60% or higher
df['Status'] = (df['G3'] / 20 >= 0.60).astype(int)

# 4. Train Models
X_train, X_test, y_train_reg, y_test_reg = train_test_split(X, df['Universal_CGPA'], test_size=0.2, random_state=42)
_, _, y_train_clf, y_test_clf = train_test_split(X, df['Status'], test_size=0.2, random_state=42)

regressor = RandomForestRegressor(n_estimators=500, random_state=42)
regressor.fit(X_train, y_train_reg)

classifier = RandomForestClassifier(n_estimators=500, random_state=42)
classifier.fit(X_train, y_train_clf)

# 5. Save Universal Models
joblib.dump(regressor, 'student_cgpa_regressor.pkl')
joblib.dump(classifier, 'student_status_classifier.pkl')

print("Universal Models Saved. Feature Sequence: [Midterm%, Internal%, Attendance%, BacklogScore%, StudyTime%]")