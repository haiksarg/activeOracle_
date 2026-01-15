import tensorflow as tf
import numpy as np
import pandas as pd
import joblib
from datasets import load_dataset
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
from sklearn.metrics import mean_absolute_error

# ============================
# 1. Load dataset
# ============================
dataset = load_dataset("Dingdong-Inc/FreshRetailNet-50K", split="train")
df = dataset.to_pandas()

df["dt"] = pd.to_datetime(df["dt"])
df = df.sort_values(["store_id", "product_id", "dt"]).reset_index(drop=True)

# ============================
# 2. Mean sales today → target tomorrow
# ============================
df["mean_today"] = df["hours_sale"].apply(np.mean)
df["mean_tomorrow"] = (
    df.groupby(["store_id", "product_id"])["mean_today"].shift(-1)
)
df = df.dropna(subset=["mean_tomorrow"])

# ============================
# 3. Tomorrow calendar
# ============================
df["dt_tomorrow"] = df["dt"] + pd.Timedelta(days=1)
df["dow_tomorrow"] = df["dt_tomorrow"].dt.weekday
df["month_tomorrow"] = df["dt_tomorrow"].dt.month
df["is_weekend"] = (df["dow_tomorrow"] >= 5).astype(int)

# ============================
# 4. Numerical features
# ============================
num_features = [
    "discount", "holiday_flag", "activity_flag",
    "precpt", "avg_temperature", "avg_humidity", "avg_wind_level",
    "stock_hour6_22_cnt",
    "mean_today",
    "dow_tomorrow", "month_tomorrow", "is_weekend"
]

scaler = StandardScaler()
df[num_features] = scaler.fit_transform(df[num_features])
joblib.dump(scaler, "scaler.save")

# ============================
# 5. Categories
# ============================
cat_features = [
    "first_category_id",
    "second_category_id",
    "third_category_id"
]

X_cat = df[cat_features].values.astype("float32")

# ============================
# 6. Hours today
# ============================
X_hours = np.stack(df["hours_sale"].values).reshape(-1, 24, 1)

X_num = df[num_features].values
y = df["mean_tomorrow"].values

# ============================
# 7. Time split
# ============================
split_date = df["dt"].quantile(0.8)
train_idx = df["dt"] <= split_date
val_idx = df["dt"] > split_date

X_cat_train, X_cat_val = X_cat[train_idx], X_cat[val_idx]
X_num_train, X_num_val = X_num[train_idx], X_num[val_idx]
X_hours_train, X_hours_val = X_hours[train_idx], X_hours[val_idx]
y_train, y_val = y[train_idx], y[val_idx]

# ============================
# 8. Model
# ============================
cat_inp = tf.keras.Input(shape=(3,), name="cat")
cat_dense = tf.keras.layers.Dense(16, activation="relu")(cat_inp)

num_inp = tf.keras.Input(shape=(len(num_features),), name="num")
num_dense = tf.keras.layers.Dense(32, activation="relu")(num_inp)

hours_inp = tf.keras.Input(shape=(24, 1), name="hours")
hours_lstm = tf.keras.layers.LSTM(32)(hours_inp)

x = tf.keras.layers.Concatenate()([cat_dense, num_dense, hours_lstm])
x = tf.keras.layers.Dense(64, activation="relu")(x)
x = tf.keras.layers.Dense(32, activation="relu")(x)

output = tf.keras.layers.Dense(1)(x)

model = tf.keras.Model([cat_inp, num_inp, hours_inp], output)

model.compile(
    optimizer="adam",
    loss="mse",
    metrics=["mae"]
)

history = model.fit(
    {"cat": X_cat_train, "num": X_num_train, "hours": X_hours_train},
    y_train,
    validation_data=(
        {"cat": X_cat_val, "num": X_num_val, "hours": X_hours_val},
        y_val
    ),
    epochs=20,
    batch_size=256
)

model.save("demand_model")

# --- MAE ---
plt.figure()
plt.plot(history.history["mae"], label="Train MAE")
plt.plot(history.history["val_mae"], label="Validation MAE")
plt.xlabel("Epoch")
plt.ylabel("MAE")
plt.title("Mean Absolute Error during training")
plt.legend()
plt.savefig("mae.png")

# --- Loss (MSE) ---
plt.figure()
plt.plot(history.history["loss"], label="Train Loss")
plt.plot(history.history["val_loss"], label="Validation Loss")
plt.xlabel("Epoch")
plt.ylabel("MSE")
plt.title("Loss (MSE) during training")
plt.legend()
plt.savefig("loss.png")

test_pred = model.predict({
    "cat": X_cat_val,
    "num": X_num_val,
    "hours": X_hours_val
})[:, 0]

mae = mean_absolute_error(y_val, test_pred)

print("TEST MAE:", mae)
