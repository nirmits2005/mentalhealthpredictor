import joblib
from fastapi import FastAPI
import pandas as pd
from pydantic import BaseModel,Field
from fastapi.middleware.cors import CORSMiddleware
from typing import Literal
model = joblib.load("mental_health_model.pkl")
class StudentData(BaseModel):
    age: int = Field(..., ge=0, le=100, description="Age of the student in years")
    gender:  Literal["Male", "Female"]
    country:  str
    academic_level:  Literal["Undergraduate", "Postgraduate", "High School"]
    most_used_platform:  Literal["Facebook", "LinkedIn", "Instagram", "Snapchat", "Twitter", "YouTube", "TikTok", "LINE", "KakaoTalk", "VKontakte", "WhatsApp", "WeChat"]
    purpose_of_use:  Literal["Networking", "Education", "Entertainment", "News"]
    avg_daily_usage_hours: float = Field(..., ge=0, le=24, description="Average daily usage hours of social media")
    daily_unlocks: int = Field(..., ge=0, description="Number of times the student unlocks their phone daily")
    study_hours: float = Field(..., ge=0, le=24, description="Average study hours per day")
    physical_activity_hours: float = Field(..., ge=0, le=24, description="Average physical activity hours per day")
    sleep_hours_per_night: float = Field(..., ge=0, le=24, description="Average sleep hours per night")
    stress_level: Literal["Low", "Medium", "High"]
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
#describe what we send back
class PredictionResponse(BaseModel):
    predicted_mental_health: float = Field(..., description="Predicted mental health status of the student")
@app.get("/")
def greet():
    return {"message": "Hello! Welcome to the Mental Health Prediction API."}
top_countries = ['Other','India','USA','Canada','Australia','UK','Germany','Mexico','Turkey','France']
@app.post("/predict", response_model=PredictionResponse)
def predict(data: StudentData):
    country_grouped = data.country if data.country in top_countries else 'Other'
    input_row = pd.DataFrame([{
    'Study_Hours': data.study_hours,
    'Age': data.age,
    'Avg_Daily_Usage_Hours': data.avg_daily_usage_hours,
    'Daily_Unlocks': data.daily_unlocks,
    'Physical_Activity_Hours': data.physical_activity_hours,
    'Sleep_Hours_Per_Night': data.sleep_hours_per_night,
    'Stress_Level': data.stress_level,
    'Gender': data.gender,
    'Academic_Level': data.academic_level,
    'Most_Used_Platform': data.most_used_platform,
    'Purpose_Of_Use': data.purpose_of_use,
    'Grouped_country': country_grouped
}])
    prediction = model.predict(input_row)[0]
    return PredictionResponse(predicted_mental_health=round(float(prediction), 2))
