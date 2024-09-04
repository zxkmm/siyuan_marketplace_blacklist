function b3cardClickListener() {
  const observer = new MutationObserver((mutationsList, observer) => {
    for (let mutation of mutationsList) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.classList && node.classList.contains("b3-card")) {
            addClickListener(node);
          } else if (node.querySelectorAll) {
            const cards = node.querySelectorAll(".b3-card");
            cards.forEach((card) => addClickListener(card));
          }
        });
      }
    }
  });

  const config = { childList: true, subtree: true };

  observer.observe(document.body, config);

  function addClickListener(element) {
    element.addEventListener("click", () => {
      console.log("click card callback");
    });
  }

  // add for current existing b3cards oncew anyway
  const initialCards = document.querySelectorAll(".b3-card");
  initialCards.forEach((card) => addClickListener(card));
}

function addBlockButton() {
  if (!checkIfItsCorrectPage()) {
    return;
  }
  console.log("222");
  const feedbackButton = document.querySelector('a[data-type="feedback"]'); // feed back icon

  if (feedbackButton) {
    const blockPluginBtn = document.createElement("a");
    blockPluginBtn.title = "集市黑名单：拉黑这个插件";
    blockPluginBtn.className = "b3-button b3-button--success"; //TODO: write and use another btn css
    blockPluginBtn.style.width = "168px";
    blockPluginBtn.textContent = "拉黑插件";

    const blockAuthorBtn = document.createElement("a");
    blockAuthorBtn.title = "集市黑名单：拉黑这个作者";
    blockAuthorBtn.className = "b3-button b3-button--success";
    blockAuthorBtn.style.width = "168px";
    blockAuthorBtn.textContent = "拉黑作者";

    ///v callback listener and worker
    blockPluginBtn.onclick = function (event) {
      event.preventDefault();
      // idk how siyuan listen the click callback
      // but just in case and also in case it changed in the future....
      console.log("click callback TODO TODO TODO!!");
    };

    blockAuthorBtn.onclick = function (event) {
      event.preventDefault(); //
      console.log("click callback TODO TODO TODO!!");
    };
    ///^

    const separator = document.createElement("div");
    separator.className = "fn__hr--b";
    const separator1 = document.createElement("div");
    separator1.className = "fn__hr--b";

    const parentDiv = feedbackButton.parentElement;

    if (parentDiv) {
      // feed back btn pos
      parentDiv.appendChild(separator);
      parentDiv.appendChild(blockPluginBtn);
      parentDiv.appendChild(separator1);
      parentDiv.appendChild(blockAuthorBtn);
      //repo etc pos
    }
  }
}

function checkIfItsCorrectPage() {
  const link = document.querySelector(
    'a[target="_blank"][class="ft__on-surface ft__smaller"][title="GitHub Repo"]',
  );
  if (link) {
    return true;
  } else {
    return false;
  }
}

function fetchGithubUserAndRepoForCurrentDisplayItem() {
  const links = document.querySelectorAll(
    'a[target="_blank"][title="GitHub Repo"]',
  );

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const href = link.getAttribute("href");
    if (href) {
      const match = href.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        const user = match[1];
        const repo = match[2];
        console.log(`USER: ${user}, REPO: ${repo}`);
        break;
      }
    }
  }
}

function fetchGithubUserForCurrentDisplayItem() {
  const links = document.querySelectorAll(
    'a[target="_blank"][title="GitHub Repo"]',
  );

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const href = link.getAttribute("href");
    if (href) {
      const match = href.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        const user = match[1];
        return user;
        // console.log(`USER: ${user}`);
        // break;
      }
    }
  }
}

function fetchGithubRepoForCurrentDisplayItem() {
  const links = document.querySelectorAll(
    'a[target="_blank"][title="GitHub Repo"]',
  );

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const href = link.getAttribute("href");
    if (href) {
      const match = href.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        const repo = match[2];
        return repo;
        // console.log(`REPO: ${repo}`);
        // break;
      }
    }
  }
}

enum BlockItemType {
  USER = "USER",
  REPO = "REPO",
}

function blockUserOrRepo(_type_, _target_) {}
b3cardClickListener();
