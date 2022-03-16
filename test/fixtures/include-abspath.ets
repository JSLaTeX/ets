<ul>
  <@ for (const pet of pets) { @>
    <@- await include(path.join(dir, 'pet'), {pet: pet}); @>
  <@ } @>
</ul>
