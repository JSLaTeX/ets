<%
let x: string;
x = "foo";
function f<T>(y: T): T {
	return y;
}
%>
<%= f<string>(x); %>