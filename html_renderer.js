const HTML_loadgame = `
<html>
<head>
<style>
	body, canvas {
		margin: 0;
		padding: 0;
	}
</style>
<link href="/prism/themes/prism.css" rel="stylesheet" />
</head>
<body onload="init()">
	<canvas id="canvas-id" width="800" height="600"></canvas>
	<script src="/common/prepishtov.js"></script>
	<script src="/ujs/{{gameId}}.js"></script>
	<script src="/common/afterpishtov.js"></script>

	<div id="code_preview"><pre><code class="lang-js"></code></pre></div>
	<script>
		fetch('/ujs/{{gameId}}.js')
		.then(resp => resp.text())
		.then(code => {
			console.log(code);
			document.getElementById('code_preview').firstChild.firstChild.textContent = code;
			Prism.highlightAll();
		});
	</script>
	<script src="/prism/prism.js"></script>
</body>
</html>
`;

const getLoadGameHTML = (gameId) => {
	return HTML_loadgame.replace(/{{gameId}}/g, gameId);
}

module.exports.getLoadGameHTML = getLoadGameHTML;
