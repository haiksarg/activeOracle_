type PredictionRow = {
	predicted_mean_per_hour: number;
	predicted_day_total: number;
};

const numberFormat = (v: number) =>
	v >= 1000 ? v.toLocaleString() : v.toFixed(v % 1 === 0 ? 0 : 2);

const PredictionsView: React.FC<{ rows: PredictionRow[] }> = ({ rows }) => {
	if (!rows || rows.length === 0) {
		return <div className="text-sm text-gray-500">Нет предсказаний.</div>;
	}

	// summary metrics
	const totalDay = rows.reduce((s, r) => s + (r.predicted_day_total ?? 0), 0);
	const avgMean = rows.reduce((s, r) => s + (r.predicted_mean_per_hour ?? 0), 0) / rows.length;
	const maxRow = rows.reduce(
		(acc, r, i) =>
			r.predicted_day_total > acc.value ? { value: r.predicted_day_total, idx: i } : acc,
		{ value: -Infinity, idx: -1 }
	);

	// chart sizing
	const chartWidth = 700; // total SVG width
	const chartHeight = 220;
	const padding = { top: 12, right: 12, bottom: 28, left: 40 };
	const innerW = chartWidth - padding.left - padding.right;
	const innerH = chartHeight - padding.top - padding.bottom;

	const maxTotal = Math.max(...rows.map((r) => r.predicted_day_total), 1);


	// bars: width and gap
	const count = rows.length;
	const gap = Math.min(6, Math.max(2, Math.floor(innerW / Math.max(40, count * 6)))); // adaptive gap
	const barW = Math.max(6, Math.floor((innerW - gap * (count - 1)) / count));



	return (
		<div>
			<div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
				<div>
					<div className="text-sm text-gray-500">Общий прогноз</div>
					<div className="text-2xl font-semibold text-gray-900">
						Общая продажа за весь день: {numberFormat(totalDay)}
					</div>
					<div className="text-sm text-gray-600 mt-1">
						Среднее в час: <span className="font-medium">{avgMean.toFixed(2)}</span>
					</div>
				</div>

				<div className="text-sm text-gray-600">
					Пик: строка <span className="font-medium">{maxRow.idx + 1}</span> —{" "}
					<span className="font-medium">{numberFormat(maxRow.value)}</span>
				</div>
			</div>

			{/* SVG chart */}
			<div className="mt-4 overflow-auto">
				<svg
					width={Math.min(chartWidth, innerW + padding.left + padding.right)}
					height={chartHeight}
					role="img"
					aria-label="Диаграмма прогнозов"
				>
					{/* axis lines */}
					<g>
						{/* y axis labels (3 ticks) */}
						{[0, 0.5, 1].map((t, i) => {
							const val = Math.round((1 - t) * maxTotal * 100) / 100;
							const y = padding.top + t * innerH;
							return (
								<g key={i}>
									<line
										x1={padding.left - 6}
										x2={padding.left - 2}
										y1={y}
										y2={y}
										stroke="#e5e7eb"
									/>
									<text
										x={padding.left - 10}
										y={y + 4}
										textAnchor="end"
										fontSize={11}
										fill="#6b7280"
									>
										{numberFormat(val)}
									</text>
								</g>
							);
						})}
					</g>

					{/* bars */}
					<g>
						{rows.map((r, i) => {
							const barHeight = (r.predicted_day_total / maxTotal) * innerH;
							const x = padding.left + i * (barW + gap);
							const y = padding.top + (innerH - barHeight);
							const isPeak = i === maxRow.idx;
							return (
								<g key={i}>
									<rect
										x={x}
										y={y}
										width={barW}
										height={Math.max(1, barHeight)}
										rx={4}
										ry={4}
										fill={isPeak ? "#15803d" : "#34d399"}
										opacity={isPeak ? 1 : 0.9}
									/>
									{/* small label above bar */}
									<text
										x={x + barW / 2}
										y={y - 2}
										textAnchor="middle"
										fontSize={12}
										fill="#065f46"
									>
										{numberFormat(r.predicted_day_total)}
									</text>
								</g>
							);
						})}
					</g>

					{/* x axis labels (every Nth) */}
					<g>
						{rows.map((_, i) => {
							const x = padding.left + i * (barW + gap) + barW / 2;
							const show = count <= 20 ? true : i % Math.ceil(count / 20) === 0;
							return show ? (
								<text
									key={i}
									x={x}
									y={padding.top + innerH + 18}
									textAnchor="middle"
									fontSize={10}
									fill="#6b7280"
								>
									{i + 1}
								</text>
							) : null;
						})}
					</g>
				</svg>
			</div>

			{/* table with details */}
			<div className="mt-4">
				<div className="text-sm text-gray-500 mb-2">Детали по строкам (первые 20):</div>
				<div className="overflow-auto border rounded-md">
					<table className="w-full text-sm">
						<thead className="bg-gray-50 text-gray-600">
							<tr>
								<th className="px-3 py-2 text-left">#</th>
								<th className="px-3 py-2 text-left">Среднее за час</th>
								<th className="px-3 py-2 text-left">Общее за день</th>
							</tr>
						</thead>
						<tbody>
							{rows.slice(0, 20).map((r, i) => (
								<tr key={i} className={i % 2 ? "bg-white" : "bg-gray-50"}>
									<td className="px-3 py-2">{i + 1}</td>
									<td className="px-3 py-2">{r.predicted_mean_per_hour.toFixed(3)}</td>
									<td className="px-3 py-2">{numberFormat(r.predicted_day_total)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

export default PredictionsView;
