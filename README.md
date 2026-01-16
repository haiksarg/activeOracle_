*bash*

ЗАПУСКАЕМ СЕРВЕР
cd ai/
python -m venv venv
source venv/bin/activate OR venv/Scripts/activate
pip install tensorflow pandas numpy scikit-learn datasets joblib fastapi uvicorn openpyxl
python3 model.py
uvicorn program:app --reload

ЗАПУСКАЕМ ИНТЕРФЕЙС
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
\. "$HOME/.nvm/nvm.sh"
nvm install 24
node -v
npm -v
cd front/
npm i
npm install react-tooltip
npm run dev