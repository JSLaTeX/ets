<ul>
  <@ for (const pet of pets) { @>
    <@- await include('pet', {pet: pet}); @>
  <@ } @>
</ul>
