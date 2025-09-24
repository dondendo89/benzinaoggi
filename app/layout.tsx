export const metadata = {
	title: 'BenzinaOggi',
	description: 'Distributori e prezzi carburanti',
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="it">
			<body>{children}</body>
		</html>
	);
}


