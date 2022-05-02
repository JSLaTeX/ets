const express = require('express');
const ets = require('embedded-ts');
const fs = require('fs');

const app = express();

const indexTemplate = fs.readFileSync('views/index.html', 'utf8');

app.get('/', async (req, res) => {
	res.send(
		await ets.render({
			template: indexTemplate,
			data: {
				title: req.query.title ?? 'Default title',
			},
		})
	);
});

app.listen(4000, () => console.log('Listening on port 4000!'));
