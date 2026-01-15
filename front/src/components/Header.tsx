import React from "react";
import { GiArtificialHive } from "react-icons/gi";

export const Header: React.FC<{ title?: string }> = ({ title = "activeOracle" }) => {
	return (
		<header className="w-full border-b border-gray-200 bg-white">
			<div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-md bg-green-600 flex items-center justify-center">
						<GiArtificialHive className="text-white" size={30} />
					</div>
					<div>
						<h1 className="text-lg font-semibold text-gray-900">{title}</h1>
					</div>
				</div>
				<nav className="text-sm text-gray-500">Проогноз активности</nav>
			</div>
		</header>
	);
};

export default Header;
