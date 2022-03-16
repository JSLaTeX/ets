<ul>
  <@ pets.forEach(function(pet){ @>
    <@- await include('pet', {pet: pet}); @>
  <@ }); @>
</ul>
