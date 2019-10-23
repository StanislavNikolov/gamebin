const HTML_loadgame = `
<html>
<head>
<style>
	body, canvas {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
	#code_preview {
		display: inline-block;
	}
	@media screen and (max-width: 1200px) {
		#code_preview {
			display: block;
		}
	}
</style>
<link href="/prism/themes/prism.css" rel="stylesheet" />
</head>
<body onload="init()">
	<canvas id="canvas-id" width="800" height="600"></canvas>
	<script src="/common/prepishtov.js"></script>
	<script src="/ujs/{{gameId}}.js"></script>
	<script src="/common/afterpishtov.js"></script>

	<span id="code_preview"><pre><code class="lang-js"></code></pre></span>
	<script>
		fetch('/ujs/{{gameId}}.js')
		.then(resp => resp.text())
		.then(code => {
			document.getElementById('code_preview').firstChild.firstChild.innerHTML = code;
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
