"""
Model 7: NLP Dialogue & Policy Query Intent Classifier
Trains on clean/07_nlp_training_dataset_ready.csv
Targets: Intent (classification)
"""
import os, numpy as np, joblib, warnings
warnings.filterwarnings('ignore')
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, f1_score
from common_utils import (
    load_csv, MODEL_DIR, BASE_DIR, RANDOM_STATE, TEST_SIZE, default_callbacks,
)

FILE_NAME = "07_nlp_training_dataset_ready.csv"
TEXT_COL = "utterance"
TARGET_COL = "Intent"
SAVE_PREFIX = "nlp_intent_model"
MAX_TOKENS = 2000
SEQUENCE_LEN = 20
EMBED_DIM = 32


def build_nlp_model(vectorize_layer, num_classes):
    keras.backend.clear_session()
    model = keras.Sequential([
        keras.Input(shape=(1,), dtype=tf.string, name="raw_text"),
        vectorize_layer,
        layers.Embedding(input_dim=MAX_TOKENS, output_dim=EMBED_DIM, mask_zero=True),
        layers.GlobalAveragePooling1D(),
        layers.Dense(32, activation="relu"),
        layers.Dropout(0.2),
        layers.Dense(num_classes, activation="softmax"),
    ], name=SAVE_PREFIX)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def main():
    print("=" * 70)
    print("MODEL 7: NLP DIALOGUE & POLICY QUERY INTENT CLASSIFIER")
    print("=" * 70)
    df = load_csv(FILE_NAME).dropna(subset=[TEXT_COL, TARGET_COL]).copy()
    df[TEXT_COL] = df[TEXT_COL].fillna("").astype(str)
    texts = np.asarray(df[TEXT_COL].tolist(), dtype=object)
    print(f"Rows: {len(df)} | Unique intents: {df[TARGET_COL].nunique()}")
    le = LabelEncoder()
    labels = le.fit_transform(df[TARGET_COL].astype(str).to_numpy())
    num_classes = len(le.classes_)
    labels = np.asarray(labels, dtype=np.int32)
    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=labels
    )
    vectorize_layer = layers.TextVectorization(
        max_tokens=MAX_TOKENS, output_mode="int", output_sequence_length=SEQUENCE_LEN,
    )
    vectorize_layer.adapt(X_train)
    model = build_nlp_model(vectorize_layer, num_classes)
    model.summary()
    X_train_2d = tf.convert_to_tensor(np.asarray(X_train, dtype=object).reshape(-1, 1), dtype=tf.string)
    X_test_2d = tf.convert_to_tensor(np.asarray(X_test, dtype=object).reshape(-1, 1), dtype=tf.string)
    history = model.fit(
        X_train_2d, y_train, validation_split=0.15, epochs=100, batch_size=8,
        callbacks=default_callbacks(patience=15), verbose=0,
    )
    probs = model.predict(X_test_2d, verbose=0)
    preds = np.argmax(probs, axis=1)
    acc = float(accuracy_score(y_test, preds))
    f1_weighted = float(f1_score(y_test, preds, average="weighted"))
    f1_macro = float(f1_score(y_test, preds, average="macro"))
    print(f"Epochs trained: {len(history.history['loss'])} (early stopping)")
    print(f"Test Accuracy: {acc:.4f} | F1(weighted): {f1_weighted:.4f} | F1(macro): {f1_macro:.4f}")
    print(f"Classes: {list(le.classes_)}")
    keras_path = os.path.join(MODEL_DIR, f"{SAVE_PREFIX}.keras")
    le_path = os.path.join(MODEL_DIR, f"{SAVE_PREFIX}_label_encoder.joblib")
    vec_path = os.path.join(MODEL_DIR, f"{SAVE_PREFIX}_vectorizer.joblib")
    model.save(keras_path)
    joblib.dump(le, le_path)
    joblib.dump(vectorize_layer, vec_path)
    return [{"model_name": "Model 7: NLP Intent Classifier",
             "algorithm": "Keras TextVectorization + Embedding + Dense",
             "task": "Classification (Intent)",
             "metric": f"Acc={acc:.3f} / F1(w)={f1_weighted:.3f}",
             "saved_as": os.path.relpath(keras_path, BASE_DIR)}]


if __name__ == "__main__":
    main()
