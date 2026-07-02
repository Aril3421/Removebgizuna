import os
import uuid
import requests
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# ------------------------------------------------------------------
# Load environment variables dari file .env
# ------------------------------------------------------------------
load_dotenv("config.env")

REMOVE_BG_API_KEY = os.getenv("REMOVE_BG_API_KEY")
REMOVE_BG_API_URL = "https://api.remove.bg/v1.0/removebg"

# ------------------------------------------------------------------
# Konfigurasi Flask
# ------------------------------------------------------------------
app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
RESULTS_FOLDER = os.path.join(BASE_DIR, "results")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_FILE_SIZE = 12 * 1024 * 1024  # 12 MB

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["RESULTS_FOLDER"] = RESULTS_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)


def allowed_file(filename: str) -> bool:
    """Cek apakah ekstensi file diizinkan."""
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload_image():
    # 1. Validasi API Key tersedia
    if not REMOVE_BG_API_KEY:
        return jsonify({
            "success": False,
            "message": "REMOVE_BG_API_KEY belum diatur di file .env"
        }), 500

    # 2. Validasi file ada dalam request
    if "image" not in request.files:
        return jsonify({
            "success": False,
            "message": "Tidak ada file gambar yang dikirim"
        }), 400

    file = request.files["image"]

    if file.filename == "":
        return jsonify({
            "success": False,
            "message": "Nama file kosong, silakan pilih gambar"
        }), 400

    if not allowed_file(file.filename):
        return jsonify({
            "success": False,
            "message": "Format file tidak didukung. Gunakan PNG, JPG, JPEG, atau WEBP"
        }), 400

    # 3. Simpan file sementara dengan nama unik
    original_ext = file.filename.rsplit(".", 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{original_ext}"
    safe_name = secure_filename(unique_name)
    upload_path = os.path.join(app.config["UPLOAD_FOLDER"], safe_name)

    try:
        file.save(upload_path)
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Gagal menyimpan file: {str(e)}"
        }), 500

    # 4. Validasi ukuran file setelah disimpan (extra safety)
    if os.path.getsize(upload_path) > MAX_FILE_SIZE:
        os.remove(upload_path)
        return jsonify({
            "success": False,
            "message": "Ukuran file terlalu besar. Maksimal 12MB"
        }), 400

    # 5. Kirim ke API remove.bg
    try:
        with open(upload_path, "rb") as image_file:
            response = requests.post(
                REMOVE_BG_API_URL,
                files={"image_file": image_file},
                data={"size": "auto"},
                headers={"X-Api-Key": REMOVE_BG_API_KEY},
                timeout=60,
            )
    except requests.exceptions.RequestException as e:
        cleanup_file(upload_path)
        return jsonify({
            "success": False,
            "message": f"Gagal terhubung ke Remove.bg API: {str(e)}"
        }), 502

    # 6. Tangani response dari remove.bg
    if response.status_code == requests.codes.ok:
        result_name = f"{uuid.uuid4().hex}.png"
        result_path = os.path.join(app.config["RESULTS_FOLDER"], result_name)

        with open(result_path, "wb") as out_file:
            out_file.write(response.content)

        cleanup_file(upload_path)

        result_url = f"/results/{result_name}"
        return jsonify({
            "success": True,
            "message": "Background berhasil dihapus",
            "result_url": result_url
        }), 200
    else:
        cleanup_file(upload_path)
        try:
            error_data = response.json()
            error_message = error_data.get("errors", [{}])[0].get(
                "title", "Terjadi kesalahan pada API Remove.bg"
            )
        except Exception:
            error_message = "Terjadi kesalahan pada API Remove.bg"

        return jsonify({
            "success": False,
            "message": error_message
        }), response.status_code


@app.route("/results/<filename>")
def get_result(filename):
    """Serve hasil gambar dari folder results."""
    safe_filename = secure_filename(filename)
    return send_from_directory(app.config["RESULTS_FOLDER"], safe_filename)


def cleanup_file(path: str):
    """Hapus file jika ada, aman dari error."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass


@app.errorhandler(413)
def file_too_large(e):
    return jsonify({
        "success": False,
        "message": "Ukuran file terlalu besar. Maksimal 12MB"
    }), 413


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
