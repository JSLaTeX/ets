<% const { default: cowsay } = await import('cowsay') %>
<%= cowsay.say({ text: 'LaTeX!' }) %>