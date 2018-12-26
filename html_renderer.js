const HTML_loadgame = `
<html>
<head>
<style>
	body, canvas {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
</style>
</head>
<body onload="init()">
	<canvas id="canvas-id" width="800" height="600">
		<script src="/common/prepishtov.js"></script>
		<script src="/ujs/{{gameId}}.js"></script>
		<script src="/common/afterpishtov.js"></script>
	</canvas>
</body>
</html>
`;

const getLoadGameHTML = (gameId) => {
	return HTML_loadgame.replace('{{gameId}}', gameId);
}

module.exports.getLoadGameHTML = getLoadGameHTML;
