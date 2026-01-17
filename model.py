import tensorflow as tf
import numpy as np
import pandas as pd
import joblib
from datasets import load_dataset
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error
import matplotlib.pyplot as plt

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
# 7. Split by products (70/15/15)
# ============================
unique_products = df["product_id"].unique()
np.random.shuffle(unique_products)

n_train = int(0.7 * len(unique_products))
n_val = int(0.15 * len(unique_products))
n_test = len(unique_products) - n_train - n_val

train_products = unique_products[:n_train]
val_products = unique_products[n_train:n_train+n_val]
test_products = unique_products[n_train+n_val:]

train_idx = df["product_id"].isin(train_products)
val_idx = df["product_id"].isin(val_products)
test_idx = df["product_id"].isin(test_products)

X_cat_train, X_cat_val, X_cat_test = X_cat[train_idx], X_cat[val_idx], X_cat[test_idx]
X_num_train, X_num_val, X_num_test = X_num[train_idx], X_num[val_idx], X_num[test_idx]
X_hours_train, X_hours_val, X_hours_test = X_hours[train_idx], X_hours[val_idx], X_hours[test_idx]
y_train, y_val, y_test = y[train_idx], y[val_idx], y[test_idx]

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

# ============================
# 9. Custom metrics
# ============================
def mape(y_true, y_pred):
    return tf.reduce_mean(tf.abs((y_true - y_pred) / (y_true + 1e-8))) * 100

def accuracy(y_true, y_pred):
    # точность как доля прогнозов с ошибкой <10%
    return tf.reduce_mean(tf.cast(tf.abs(y_true - y_pred) / (y_true + 1e-8) < 0.1, tf.float32))

model.compile(
    optimizer="adam",
    loss="mse",
    metrics=["mae", mape, accuracy]
)

# ============================
# 10. Train
# ============================
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

# ============================
# 11. Plot metrics
# ============================
metrics = ["mae", "loss", "mape", "accuracy"]
for metric in metrics:
    plt.figure()
    plt.plot(history.history[metric], label=f"Train {metric}")
    plt.plot(history.history[f"val_{metric}"], label=f"Val {metric}")
    plt.xlabel("Epoch")
    plt.ylabel(metric.upper())
    plt.title(f"{metric.upper()} during training")
    plt.legend()
    plt.savefig(f"{metric}.png")

# ============================
# 12. Test evaluation
# ============================
y_pred = model.predict({
    "cat": X_cat_test,
    "num": X_num_test,
    "hours": X_hours_test
})[:, 0]

test_mae = mean_absolute_error(y_test, y_pred)
test_mse = mean_squared_error(y_test, y_pred)
test_mape = mean_absolute_percentage_error(y_test, y_pred) * 100

test_acc = np.mean(np.abs(y_test - y_pred) / (y_test + 1e-8) < 0.1)

print("TEST MAE:", test_mae)
print("TEST MSE:", test_mse)
print("TEST MAPE:", test_mape)
print("TEST Accuracy (<10% error):", test_acc)
