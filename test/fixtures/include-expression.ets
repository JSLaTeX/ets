<ul>
  <%- 'ping: ' + (await include('hello-world')).replace(/world/, 'planet'); %>
</ul>
