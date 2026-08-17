(function(){
  const dialog=document.getElementById("loaderPreviewDialog");
  const dialogStage=document.getElementById("dialogStage");
  const dialogTitle=document.getElementById("dialogTitle");

  function replay(stage){
    if(!stage)return;
    stage.classList.add("is-replaying");
    void stage.offsetWidth;
    requestAnimationFrame(()=>stage.classList.remove("is-replaying"));
  }

  document.addEventListener("click",event=>{
    const replayButton=event.target.closest("[data-replay]");
    if(replayButton){
      replay(replayButton.closest(".concept-card")?.querySelector(".loader-stage"));
      return;
    }

    const focusButton=event.target.closest("[data-focus]");
    if(focusButton){
      const card=focusButton.closest(".concept-card");
      const source=card?.querySelector(".loader-stage");
      if(!source)return;
      dialogTitle.textContent=card.querySelector(".concept-meta strong")?.textContent||"JourneyDeck loader";
      dialogStage.replaceChildren(source.cloneNode(true));
      dialog.showModal();
      replay(dialogStage.querySelector(".loader-stage"));
      return;
    }

    if(event.target.closest("[data-dialog-replay]")){
      replay(dialogStage.querySelector(".loader-stage"));
      return;
    }

    if(event.target.closest("[data-close]"))dialog.close();
  });

  dialog.addEventListener("click",event=>{
    if(event.target===dialog)dialog.close();
  });
})();
