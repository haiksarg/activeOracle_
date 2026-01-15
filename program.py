from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import tensorflow as tf
import joblib
from io import BytesIO

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Загружаем модель и scaler
model = tf.keras.models.load_model("demand_model")
scaler = joblib.load("scaler.save")

num_features = [
    "discount", "holiday_flag", "activity_flag",
    "precpt", "avg_temperature", "avg_humidity", "avg_wind_level",
    "stock_hour6_22_cnt",
    "mean_today",
    "dow_tomorrow", "month_tomorrow", "is_weekend"
]


@app.post("/predict")
async def predict(today_file: UploadFile = File(...),
                  tomorrow_file: UploadFile = File(...)):

    # Загружаем данные
    df_today = pd.read_excel(BytesIO(await today_file.read()))
    df_tomorrow = pd.read_excel(BytesIO(await tomorrow_file.read()))

    # Средняя продажа за сегодня
    df_today["mean_today"] = df_today["hours_sale_today"].apply(
        lambda x: np.mean(eval(str(x))))

    # Переименовываем колонки завтрашнего дня, чтобы не было дубликатов
    suffix = "_tomorrow"
    df_tomorrow_renamed = df_tomorrow.rename(
        columns={c: c + suffix
                 for c in df_tomorrow.columns if c != "hours_sale_tomorrow"}
    )

    # Объединяем
    df = pd.concat(
        [df_today.reset_index(drop=True),
         df_tomorrow_renamed.reset_index(drop=True)],
        axis=1)

    # Категориальные признаки (только категории товара)
    X_cat = df[["first_category_id",
                "second_category_id",
                "third_category_id"]].values.astype("float32")

    # Числовые признаки
    # Для признаков завтрашнего дня они уже
    # переименованы, поэтому дубликатов нет
    df_num = df.reindex(columns=num_features, fill_value=0)
    X_num = scaler.transform(df_num)

    # Часовые продажи сегодня для LSTM
    X_hours = np.stack(df["hours_sale_today"].apply(
        lambda x: np.array(eval(str(x)))).values)
    X_hours = X_hours.reshape(-1, 24, 1)

    # Предсказания модели
    preds = model.predict({"cat": X_cat, "num": X_num, "hours": X_hours})[:, 0]

    # Формируем итоговый ответ
    return {
        "rows": [
            {
                "predicted_mean_per_hour": float(preds[i]),
                "predicted_day_total": float(preds[i]*24)
            }
            for i in range(len(preds))
        ]
    }
