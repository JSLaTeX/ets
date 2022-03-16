<ul>
  <@ pets.forEach(function(pet){ @>
    <@- await include(path.join(dir, 'pet'), {pet: pet}); @>
  <@ }); @>
</ul>
