$("#loggedIn").click(function() {
  if(!$("#loggedIn option:selected").hasClass("no_link"))
    window.location.href=$(this).val();
});
