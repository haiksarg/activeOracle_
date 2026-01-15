import React, { useState } from "react";
import PredictionsView from "./PredictionsView";
import { Tooltip } from "react-tooltip";
import { HiQuestionMarkCircle } from "react-icons/hi";

type ParsedRow = Record<string, any>;

type ColumnsCheck = {
	ok: boolean;
	missing: string[];
};

const parseCSV = (text: string): ParsedRow[] => {
	const lines = text
		.trim()
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);
	if (lines.length === 0) return [];
	const header = lines[0].split(",").map((h) => h.trim());
	const rows = lines.slice(1).map((line) => {
		const cols = line.split(",").map((c) => c.trim());
		const obj: ParsedRow = {};
		header.forEach((h, i) => (obj[h || `col${i + 1}`] = cols[i] ?? null));
		return obj;
	});
	return rows;
};

const REQUIRED_TODAY = [
	"first_category_id",
	"second_category_id",
	"third_category_id",
	"discount",
	"holiday_flag",
	"activity_flag",
	"precpt",
	"avg_temperature",
	"avg_humidity",
	"avg_wind_level",
	"stock_hour6_22_cnt",
	"hours_sale_today",
];

const REQUIRED_TOMORROW = [
	"discount",
	"holiday_flag",
	"activity_flag",
	"precpt",
	"avg_temperature",
	"avg_humidity",
	"avg_wind_level",
	"dow_tomorrow",
	"month_tomorrow",
	"is_weekend",
];

const hasRequiredColumns = (rows: ParsedRow[] | null, required: string[]): ColumnsCheck => {
	if (!rows || rows.length === 0) {
		return { ok: false, missing: required };
	}

	const keys = Object.keys(rows[0]).map((k) => k.toString().trim());
	const missing = required.filter((r) => !keys.includes(r));

	return {
		ok: missing.length === 0,
		missing,
	};
};

const InteractionBlock: React.FC = () => {
	const [todayName, setTodayName] = useState<string | null>(null);
	const [tomorrowName, setTomorrowName] = useState<string | null>(null);
	const [todayFile, setTodayFile] = useState<File | null>(null);
	const [tomorrowFile, setTomorrowFile] = useState<File | null>(null);

	const [todayRows, setTodayRows] = useState<ParsedRow[] | null>(null);
	const [tomorrowRows, setTomorrowRows] = useState<ParsedRow[] | null>(null);

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [responseData, setResponseData] = useState<any | null>(null);

	async function parseFileToRows(f: File): Promise<ParsedRow[]> {
		const name = f.name.toLowerCase();
		if (name.endsWith(".csv")) {
			const txt = await f.text();
			return parseCSV(txt);
		}
		if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
			// dynamic import to keep xlsx optional
			const XLSX = await import("xlsx");
			const arrayBuffer = await f.arrayBuffer();
			const workbook = XLSX.read(arrayBuffer, { type: "array" });
			const firstSheetName = workbook.SheetNames[0];
			const sheet = workbook.Sheets[firstSheetName];
			// defval: null ensures missing cells are null
			const json = XLSX.utils.sheet_to_json(sheet, { defval: null }) as ParsedRow[];
			return json;
		}
		throw new Error("Поддерживаются только CSV и XLSX файлы.");
	}

	async function handleTodayFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		setError(null);
		setResponseData(null);
		const f = e.target.files?.[0] ?? null;
		setTodayFile(f);
		setTodayName(f?.name ?? null);
		setTodayRows(null);
		if (!f) return;
		try {
			const rows = await parseFileToRows(f);
			setTodayRows(rows);
		} catch (err: any) {
			// специальное сообщение для xlsx
			if (
				String(err).includes("Cannot find module 'xlsx'") ||
				String(err).includes("Cannot resolve")
			) {
				setError("Для разбора XLSX требуется пакет `xlsx`. Установите: npm i xlsx");
			} else {
				setError(err?.message ?? String(err));
			}
		}
	}

	async function handleTomorrowFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		setError(null);
		setResponseData(null);
		const f = e.target.files?.[0] ?? null;
		setTomorrowFile(f);
		setTomorrowName(f?.name ?? null);
		setTomorrowRows(null);
		if (!f) return;
		try {
			const rows = await parseFileToRows(f);
			setTomorrowRows(rows);
		} catch (err: any) {
			if (
				String(err).includes("Cannot find module 'xlsx'") ||
				String(err).includes("Cannot resolve")
			) {
				setError("Для разбора XLSX требуется пакет `xlsx`. Установите: npm i xlsx");
			} else {
				setError(err?.message ?? String(err));
			}
		}
	}

	async function handleSend() {
		setError(null);
		setResponseData(null);

		if (!todayFile) {
			setError("Загрузите файл today (today.xlsx / .csv).");
			return;
		}
		if (!tomorrowFile) {
			setError("Загрузите файл tomorrow (tomorrow.xlsx / .csv).");
			return;
		}

		// Собираем FormData с файлами. Имена полей — 'today' и 'tomorrow'
		const fd = new FormData();
		fd.append("today_file", todayFile);
		fd.append("tomorrow_file", tomorrowFile);

		setLoading(true);
		try {
			const res = await fetch("http://127.0.0.1:8000/predict", {
				method: "POST",
				body: fd,
			});

			if (!res.ok) {
				const txt = await res.text();
				throw new Error(`Server error: ${res.status} ${txt}`);
			}

			const json = await res.json();
			console.log(json);
			setResponseData(json);
		} catch (err: any) {
			setError(err?.message ?? String(err));
		} finally {
			setLoading(false);
		}
	}

	const previewCount = 5;
	const todayPreview = todayRows ? todayRows.slice(0, previewCount) : [];
	const tomorrowPreview = tomorrowRows ? tomorrowRows.slice(0, previewCount) : [];

	const chkToday = hasRequiredColumns(todayRows, REQUIRED_TODAY);
	const chkTomorrow = hasRequiredColumns(tomorrowRows, REQUIRED_TOMORROW);

	return (
		<div className="max-w-5xl mx-auto px-4 my-8">
			<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
				<div className="mb-4 flex flex-col items-start">
					<h2 className="text-lg mb-2 font-medium text-gray-900">
						Прогнозирование активности
					</h2>
					<p className="text-sm text-gray-500">
						Загрузите две таблицы: <strong>today</strong> (с сегодняшними данными) и{" "}
						<strong>tomorrow</strong> (с признаками на завтра).
					</p>
					<div className="flex gap-2 items-center">
						<a
							href="../assets/today.xlsx"
							download
							className="mt-2 px-3 py-2 rounded-md bg-green-600 text-white text-sm"
						>
							Скачать шаблон таблицы today
						</a>
						<p data-tooltip-id="today">
							<HiQuestionMarkCircle size={25} color="oklch(62.7% 0.194 149.214)" />
						</p>
						<Tooltip id="today">
							<div>
								<ul>
									<li>
										<strong>first_category_id</strong> - первая категория товара
									</li>
									<li>
										<strong>second_category_id</strong> - вторая категория товара
									</li>
									<li>
										<strong>third_category_id</strong> - третья категория товара
									</li>
									<li>
										<strong>discount</strong> - процент скидки на товар (от 0 до 1)
									</li>
									<li>
										<strong>holiday_flag</strong> - есть ли праздник (0 - нет, 1 - есть)
									</li>
									<li>
										<strong>activity_flag</strong> - есть ли какая-то промо акция (0 -
										нет, 1 - есть)
									</li>
									<li>
										<strong>precpt</strong> - уровень осадков
									</li>
									<li>
										<strong>avg_temperature</strong> - средняя температура
									</li>
									<li>
										<strong>avg_humidity</strong> - средняя влажность
									</li>
									<li>
										<strong>avg_wind_level</strong> - средний уровень силы ветра
									</li>
									<li>
										<strong>stock_hour6_22_cnt</strong> - количество часов отсутствия
										товара на складе с 6:00 до 22:00
									</li>
									<li>
										<strong>hours_sale_today</strong> - массив из 24 чисел. Количество
										продаж товара за каждый час [ч1,ч2,ч3...]
									</li>
								</ul>
							</div>
						</Tooltip>
					</div>
					<div className="flex gap-2 items-center">
						<a
							href="../assets/tomorrow.xlsx"
							download
							className="mt-2 px-3 py-2 rounded-md bg-green-600 text-white text-sm"
						>
							Скачать шаблон таблицы tomorrow
						</a>
						<p data-tooltip-id="tomorrow">
							<HiQuestionMarkCircle size={25} color="oklch(62.7% 0.194 149.214)" />
						</p>
						<Tooltip id="tomorrow">
							<div>
								<ul>
									<li>
										<strong>discount</strong> - процент скидки на товар (от 0 до 1)
									</li>
									<li>
										<strong>holiday_flag</strong> - есть ли праздник (0 - нет, 1 - есть)
									</li>
									<li>
										<strong>activity_flag</strong> - есть ли какая-то промо акция (0 -
										нет, 1 - есть)
									</li>
									<li>
										<strong>precpt</strong> - уровень осадков
									</li>
									<li>
										<strong>avg_temperature</strong> - средняя температура
									</li>
									<li>
										<strong>avg_humidity</strong> - средняя влажность
									</li>
									<li>
										<strong>avg_wind_level</strong> - средний уровень силы ветра
									</li>
									<li>
										<strong>dow_tomorrow</strong> - номер дня недели завтра (1 -
										понедельник, 2 - вторник, ...)
									</li>
									<li>
										<strong>month_tomorrow</strong> - номер месяца завтра (1 - январь, 2 -
										февраль, ...)
									</li>
									<li>
										<strong>is_weekend</strong> - выходной ли завтра день (0 - нет, 1 -
										да)
									</li>
								</ul>
							</div>
						</Tooltip>
					</div>
				</div>

				<div className="grid md:grid-cols-2 gap-4">
					{/* Today upload */}
					<div className="p-4 border border-green-600 rounded-md">
						<div className="flex items-center gap-3 mb-2">
							<label className="flex items-center gap-3 w-full md:w-auto cursor-pointer">
								<input
									type="file"
									accept=".csv,.xlsx,.xls"
									onChange={handleTodayFileChange}
									className="hidden"
								/>
								<span className="btn inline-block px-3 py-2 rounded-md bg-green-600 text-white text-sm">
									Данные на сегодня
								</span>
							</label>
							<div className="text-sm text-gray-500">{todayName ?? "файл не выбран"}</div>
						</div>

						<div className="text-xs text-gray-500 mb-2">
							Обязательные колонки: {REQUIRED_TODAY.join(", ")}
						</div>
						{!chkToday.ok && todayRows ? (
							<div className="text-sm text-red-600 mb-2">
								Отсутствуют: {chkToday.missing.join(", ")}
							</div>
						) : null}

						<div className="text-sm text-gray-600 mb-2">Превью (первые {previewCount}):</div>
						<div className="overflow-auto max-h-48 border border-gray-100 rounded-md p-2 bg-gray-50">
							{todayPreview.length > 0 ? (
								<table className="w-full text-sm">
									<thead>
										<tr className="text-left text-gray-600">
											{Object.keys(todayPreview[0]).map((k) => (
												<th key={k} className="pr-4 pb-2">
													{k}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{todayPreview.map((row, i) => (
											<tr key={i} className="even:bg-white odd:bg-gray-50">
												{Object.keys(todayPreview[0]).map((k) => (
													<td key={k} className="pr-1 py-1">
														{String(row[k])}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							) : (
								<div className="text-sm text-gray-400">Нет данных</div>
							)}
						</div>
					</div>

					{/* Tomorrow upload */}
					<div className="p-4 border border-green-600 rounded-md">
						<div className="flex items-center gap-3 mb-2">
							<label className="flex items-center gap-3 w-full md:w-auto cursor-pointer">
								<input
									type="file"
									accept=".csv,.xlsx,.xls"
									onChange={handleTomorrowFileChange}
									className="hidden"
								/>
								<span className="btn inline-block px-3 py-2 rounded-md bg-green-600 text-white text-sm">
									Данные на завтра
								</span>
							</label>
							<div className="text-sm text-gray-500">{tomorrowName ?? "файл не выбран"}</div>
						</div>

						<div className="text-xs text-gray-500 mb-2">
							Обязательные колонки: {REQUIRED_TOMORROW.join(", ")}
						</div>
						{!chkTomorrow.ok && tomorrowRows ? (
							<div className="text-sm text-red-600 mb-2">
								Отсутствуют: {chkTomorrow.missing.join(", ")}
							</div>
						) : null}

						<div className="text-sm text-gray-600 mb-2">Превью (первые {previewCount}):</div>
						<div className="overflow-auto max-h-48 border border-gray-100 rounded-md p-2 bg-gray-50">
							{tomorrowPreview.length > 0 ? (
								<table className="w-full text-sm">
									<thead>
										<tr className="text-left text-gray-600">
											{Object.keys(tomorrowPreview[0]).map((k) => (
												<th key={k} className="pr-4 pb-2">
													{k}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{tomorrowPreview.map((row, i) => (
											<tr key={i} className="even:bg-white odd:bg-gray-50">
												{Object.keys(tomorrowPreview[0]).map((k) => (
													<td key={k} className="pr-4 py-1">
														{String(row[k])}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							) : (
								<div className="text-sm text-gray-400">Нет данных</div>
							)}
						</div>
					</div>
				</div>

				{/* warnings / actions */}
				<div className="mt-4 flex flex-col md:flex-row gap-3 items-center">
					{todayRows && tomorrowRows && todayRows.length !== tomorrowRows.length ? (
						<div className="text-sm text-yellow-700">
							Внимание: количество строк в today ({todayRows.length}) и tomorrow (
							{tomorrowRows.length}) не совпадает.
						</div>
					) : null}

					<div className="ml-auto">
						<button
							onClick={handleSend}
							disabled={
								loading ||
								!todayRows ||
								!tomorrowRows ||
								todayRows.length === 0 ||
								tomorrowRows.length === 0 ||
								!chkToday.ok ||
								!chkTomorrow.ok
							}
							className={`px-4 py-2 rounded-md text-sm font-medium ${
								loading ||
								!todayRows ||
								!tomorrowRows ||
								todayRows.length === 0 ||
								tomorrowRows.length === 0 ||
								!chkToday.ok ||
								!chkTomorrow.ok
									? "bg-gray-200 text-gray-500 cursor-not-allowed pointer-events-none"
									: "bg-green-600 text-white"
							}`}
						>
							{loading ? "Отправка..." : "Отправить на сервер"}
						</button>
					</div>
				</div>

				{error ? (
					<div className="mt-4 text-sm text-red-600 whitespace-pre-line">{error}</div>
				) : null}

				<div className="mt-6">
					<div className="rounded-md border border-gray-100 bg-white p-3 min-h-[56px]">
						{responseData?.rows ? (
							<PredictionsView rows={responseData.rows} />
						) : (
							<div className="text-sm text-gray-400">
								Ответ будет показан здесь после отправки.
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default InteractionBlock;
