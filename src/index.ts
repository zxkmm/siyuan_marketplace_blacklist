import { Plugin, showMessage, Dialog } from "siyuan";
import "@/index.scss";

import { SettingUtils } from "./libs/setting-utils";
import { checkOpenSource, isCacheStale, CheckResult, OpenSourceCache, OS_CACHE_FILE } from "./opensource-checker";

const STORAGE_NAME = "menu-config";

var packageNameClass = document.getElementsByClassName("ft__on-surface");

enum BlockItemType {
  USER = "USER",
  REPO = "REPO",
}

export default class siyuan_rmv_btn extends Plugin {
  private settingUtils: SettingUtils;
  private openSourceCache: OpenSourceCache = {};
  private isMisteryCodeValid: boolean = false;

  convertStringToArray(userInput) {
    if (userInput) {
      var inputArray = userInput.split(/[,，]/);
      for (let i = 0; i < inputArray.length; i++) {
        inputArray[i] = inputArray[i].trim();
      }
      return inputArray;
    } else {
      // 处理 undefined
      return [];
    }
  }

  getAuthorList() {
    const list = this.convertStringToArray(this.settingUtils.get("authorBlacklist"));
    return list;
  }

  applyStyles(css) {
    // console.log("applyStyles");
    // console.log(css);
    const head = document.head || document.getElementsByTagName("head")[0];
    const style = document.createElement("style");
    head.appendChild(style);
    style.appendChild(document.createTextNode(css));
  }

  rmvMarketPlaceCardsByNameJs(_toRemoveListArray_, _toRemoveAuthorListArray_ = []) {
    var siyuanMarketPlaceObserver = new MutationObserver(function (
      mutationsList,
      observer,
    ) {
      const cards = document.querySelectorAll(".b3-card");
      cards.forEach((card) => {
        const dataObjStr = card.getAttribute("data-obj");
        if (dataObjStr) {
          try {
            const dataObj = JSON.parse(dataObjStr);
            if (dataObj && dataObj.name && _toRemoveListArray_.includes(dataObj.name)) {
              (card as HTMLElement).style.display = "none";
            } else if (dataObj && dataObj.repoURL) {
              const repoMatch = dataObj.repoURL.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)/);
              if (repoMatch && repoMatch[2] && _toRemoveListArray_.includes(repoMatch[2])) {
                (card as HTMLElement).style.display = "none";
              } else if (repoMatch && repoMatch[1] && _toRemoveAuthorListArray_.includes(repoMatch[1])) {
                (card as HTMLElement).style.display = "none";
              }
            }
          } catch (e) {
            // ignore
          }
        }
      });
    });

    siyuanMarketPlaceObserver.observe(document, {
      childList: true,
      subtree: true,
      characterData: false,
    });
  }

  rmvMarketPlaceCardsByNameCss(_toRemovePackageNameListArray_) {
    /** core css
     *
     *
     * .b3-card[data-obj*='"name":"siyuan_global_zoom"'] {
     *        display: none;
     * }
     *
     *
     */

    var _arr_with_css_ = [];
    for (var i = 0; i < _toRemovePackageNameListArray_.length; i++) {
      //the second one is just in case that someone use different name for repo and package name.....stupid...
      _arr_with_css_.push(
        `.b3-card[data-obj*='"name":"${_toRemovePackageNameListArray_[i]}"'] {
            display: none;
        }
        .b3-card[data-obj*='"repoURL":"https://github.com/'][data-obj*='/${_toRemovePackageNameListArray_[i]}'] {
            display: none;
        }
        `,
      );
    }

    for (var i = 0; i < _arr_with_css_.length; i++) {
      this.applyStyles(_arr_with_css_[i]);
    }
  }

  rmvMarketPlaceCardsByGitHubUsernameCss(_toRemoveGitHubUsernameListArray_) {
    /**
     * fixd part of that identifier string: "repoURL":"https://github.com/{USERNAME}/
     *
     * core css
     *
     * .b3-card[data-obj*='"repoURL":"https://github.com/${_toRemoveListArray_[i]}/'] {
     */

    var _arr_with_css_ = [];

    for (var i = 0; i < _toRemoveGitHubUsernameListArray_.length; i++) {
      _arr_with_css_.push(
        `.b3-card[data-obj*='"repoURL":"https://github.com/${_toRemoveGitHubUsernameListArray_[i]}/'] {
        display: none;
        }`,
      );
    }

    // console.log("arr_with_css" + _arr_with_css_);

    for (var i = 0; i < _arr_with_css_.length; i++) {
      this.applyStyles(_arr_with_css_[i]);
    }
  }

  b3cardClickListener() {
    // console.log("called");
    const observer = new MutationObserver((mutationsList, observer) => {
      for (let mutation of mutationsList) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.classList && node.classList.contains("b3-card")) {
              this.addClickListener(node);
            } else if (node.querySelectorAll) {
              const cards = node.querySelectorAll(".b3-card");
              cards.forEach((card) => this.addClickListener(card));
            }
          });
        }
      }
    });

    const config = { childList: true, subtree: true };

    observer.observe(document.body, config);

    // add for current existing b3cards once anyway
    const initialCards = document.querySelectorAll(".b3-card");
    initialCards.forEach((card) => this.addClickListener(card));
  }

  addClickListener(element) {
    element.addEventListener("click", () => {
      // console.log("click card callback");
      for (let i = 0; i < 20; i++) {
        setTimeout(() => this.addBlockButton(), i * 50);
      }
    });
  }

  checkIfItsCorrectPage() {
    const link = document.querySelector(
      'a[target="_blank"][class="ft__on-surface ft__smaller"][title="GitHub Repo"]',
    );
    if (link) {
      return true;
    } else {
      return false;
    }
  }

  fetchGithubUserAndRepoForCurrentDisplayItem() {
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

  fetchGithubUserForCurrentDisplayItem() {
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

  fetchGithubRepoForCurrentDisplayItem() {
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

  // export function backToList() {
  //   const backBtn = document.querySelector('div[data-type="goBack"]');
  //   if (backBtn) {
  //     backBtn.click();
  //   }
  // }

  backToList() {
    const backBtn = document.querySelector('div[data-type="goBack"]');
    if (backBtn && backBtn instanceof HTMLElement) {
      backBtn.click();
    }
  }

  addBlockButton() {
    if (!this.checkIfItsCorrectPage()) {
      return;
    }

    const existingNewlyAddedElem = document.querySelectorAll(
      '[zxkmm_global_identifier="new_added_element"]',
    );

    if (existingNewlyAddedElem.length > 0) {
      existingNewlyAddedElem.forEach((elem) => elem.remove());
    }

    const feedbackButton = document.querySelector('a[data-type="feedback"]'); // feed back icon

    if (feedbackButton) {
      const blockPluginBtn = document.createElement("a");
      blockPluginBtn.title = this.i18n.blockPluginPopupHint;
      blockPluginBtn.className = "b3-button b3-button--blacklist"; //TODO: write and use another btn css
      blockPluginBtn.style.width = "168px";
      blockPluginBtn.textContent = this.i18n.blockPluginButton;
      blockPluginBtn.setAttribute(
        "zxkmm_global_identifier",
        "new_added_element",
      );

      const blockAuthorBtn = document.createElement("a");
      blockAuthorBtn.title = this.i18n.blockUserPopupHint;
      blockAuthorBtn.className = "b3-button b3-button--blacklist";
      blockAuthorBtn.style.width = "168px";
      blockAuthorBtn.textContent = this.i18n.blockUserButton;
      blockAuthorBtn.setAttribute(
        "zxkmm_global_identifier",
        "new_added_element",
      );

      ///v callback listener and worker
      blockPluginBtn.onclick = (event: Event) => {
        event.preventDefault();
        // idk how siyuan listen the click callback
        // but just in case and also in case it changed in the future....
        // console.log("click callback TODO TODO TODO!!");
        const userName = this.fetchGithubRepoForCurrentDisplayItem();
        this.appendCurrentItemIntoList(BlockItemType.REPO, userName);
      };

      blockAuthorBtn.onclick = (event: Event) => {
        event.preventDefault(); //
        // console.log("click callback TODO TODO TODO!!");
        const userName = this.fetchGithubUserForCurrentDisplayItem();
        this.appendCurrentItemIntoList(BlockItemType.USER, userName);
      };
      ///^

      const checkOpenSourceBtn = document.createElement("a");
      checkOpenSourceBtn.title = this.i18n.checkOpenSourcePopupHint;
      checkOpenSourceBtn.className = "b3-button b3-button--os-check";
      checkOpenSourceBtn.style.width = "168px";
      checkOpenSourceBtn.textContent = this.i18n.checkOpenSourceButton;
      checkOpenSourceBtn.setAttribute("zxkmm_global_identifier", "new_added_element");
      checkOpenSourceBtn.onclick = (event: Event) => {
        event.preventDefault();
        this.handleOpenSourceCheck(checkOpenSourceBtn);
      };

      const separator = document.createElement("div");
      separator.className = "fn__hr--b";
      separator.setAttribute("zxkmm_global_identifier", "new_added_element");

      const separator1 = document.createElement("div");
      separator1.className = "fn__hr--b";
      separator1.setAttribute("zxkmm_global_identifier", "new_added_element");

      const separator2 = document.createElement("div");
      separator2.className = "fn__hr--b";
      separator2.setAttribute("zxkmm_global_identifier", "new_added_element");

      const parentDiv = feedbackButton.parentElement;

      if (parentDiv) {
        parentDiv.appendChild(separator);
        parentDiv.appendChild(blockPluginBtn);
        parentDiv.appendChild(separator1);
        parentDiv.appendChild(blockAuthorBtn);

        if (this.isMisteryCodeValid) {
          parentDiv.appendChild(separator2);
          parentDiv.appendChild(checkOpenSourceBtn);
        }
      }
    }
  }

  async handleOpenSourceCheck(btn: HTMLAnchorElement) {
    const owner = this.fetchGithubUserForCurrentDisplayItem();
    const repo = this.fetchGithubRepoForCurrentDisplayItem();
    if (!owner || !repo) {
      showMessage("Could not determine repository from current page", 3000, "error");
      return;
    }

    const cacheKey = `${owner}/${repo}`;
    const cached = this.openSourceCache[cacheKey];
    if (cached && !isCacheStale(cached)) {
      this.showOpenSourceDialog(cached, owner, repo, true);
      return;
    }

    const originalText = btn.textContent;
    btn.textContent = this.i18n.checkOpenSourceChecking;
    btn.style.opacity = "0.6";
    btn.style.pointerEvents = "none";

    try {
      const token = (this.settingUtils.get("githubToken") as string | undefined)?.trim() || undefined;
      const result = await checkOpenSource(owner, repo, token);
      this.openSourceCache[cacheKey] = result;
      await this.saveData(OS_CACHE_FILE, this.openSourceCache);
      this.showOpenSourceDialog(result, owner, repo, false);
    } catch (e: any) {
      showMessage(`${this.i18n.checkOpenSourceError}: ${e?.message ?? e}`, 5000, "error");
    } finally {
      btn.textContent = originalText;
      btn.style.opacity = "";
      btn.style.pointerEvents = "";
    }
  }

  showOpenSourceDialog(result: CheckResult, owner: string, repo: string, isCached: boolean) {
    const scoreClass =
      result.score >= 80 ? "os-score--high"
        : result.score >= 60 ? "os-score--good"
          : result.score >= 40 ? "os-score--medium"
            : result.score >= 20 ? "os-score--low"
              : "os-score--very-low";

    const checkedAt = new Date(result.checkedAt).toLocaleString();
    const cacheBadge = isCached
      ? `<span class="os-cache-badge">${this.i18n.checkOpenSourceCacheNote}</span>`
      : `<span class="os-fresh-badge">${this.i18n.checkOpenSourceFreshNote}</span>`;

    const errorHtml = result.error
      ? `<div class="os-error"><strong>${this.i18n.checkOpenSourceError}:</strong> ${result.error}</div>`
      : "";

    let signalsHtml = "";
    if (result.signals.length > 0) {
      const rows = result.signals.map(sig => {
        const cls = sig.score > 0 ? "os-sig-positive" : sig.score < 0 ? "os-sig-negative" : "os-sig-neutral";
        const scoreStr = sig.score > 0 ? `+${sig.score}` : `${sig.score}`;
        return `<tr>
          <td class="os-sig-label">${sig.label}</td>
          <td class="${cls} os-sig-score">${scoreStr}/${sig.max}</td>
          <td class="os-sig-details">${sig.details}</td>
        </tr>`;
      }).join("");
      signalsHtml = `
        <table class="os-signals-table">
          <thead><tr>
            <th>${this.i18n.checkOpenSourceSignalCheck}</th>
            <th>${this.i18n.checkOpenSourceSignalScore}</th>
            <th>${this.i18n.checkOpenSourceSignalDetails}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    const html = `
      <div class="os-check-result">
        <div class="os-header">
          <div class="os-score-circle ${scoreClass}">${result.score}</div>
          <div class="os-header-info">
            <div class="os-grade">${result.grade}</div>
            <div class="os-meta">${this.i18n.checkOpenSourceCheckedAt}: ${checkedAt} ${cacheBadge}</div>
          </div>
        </div>
        ${errorHtml}
        ${signalsHtml}
        <div class="os-footer">
          <button class="b3-button b3-button--outline os-recheck-btn" id="os-recheck-btn">
            ${this.i18n.checkOpenSourceRecheck}
          </button>
        </div>
      </div>`;

    const dialog = new Dialog({
      title: `${this.i18n.checkOpenSourceResultTitle} — ${owner}/${repo}`,
      content: html,
      width: "720px",
    });

    const recheckBtn = dialog.element.querySelector("#os-recheck-btn");
    recheckBtn?.addEventListener("click", async () => {
      dialog.destroy();
      const loadingDialog = new Dialog({
        title: this.i18n.checkOpenSourceResultTitle,
        content: `<div class="os-loading"><div class="os-loading-text">${this.i18n.checkOpenSourceChecking}</div></div>`,
        width: "300px",
        disableClose: true,
      });
      try {
        const token = (this.settingUtils.get("githubToken") as string | undefined)?.trim() || undefined;
        const newResult = await checkOpenSource(owner, repo, token);
        this.openSourceCache[`${owner}/${repo}`] = newResult;
        await this.saveData(OS_CACHE_FILE, this.openSourceCache);
        loadingDialog.destroy();
        this.showOpenSourceDialog(newResult, owner, repo, false);
      } catch (e: any) {
        loadingDialog.destroy();
        showMessage(`${this.i18n.checkOpenSourceError}: ${e?.message ?? e}`, 5000, "error");
      }
    });
  }

  appendCurrentItemIntoList(_block_type_: BlockItemType, _block_name_: string) {
    try {
      // 注意await
      var enableDeviceList;
      switch (_block_type_) {
        case BlockItemType.REPO:
          enableDeviceList = this.settingUtils.get("pluginBlacklist");
          break;
        case BlockItemType.USER:
          enableDeviceList = this.settingUtils.get("authorBlacklist");
          break;
      }

      var blockListeArray = enableDeviceList.split(",");
      var blockListArrayLength = blockListeArray.length;
      var blockListArrayLast = blockListeArray[blockListArrayLength - 1];

      // remove empty line
      if (blockListArrayLast === "") {
        blockListeArray.pop();
      }

      blockListeArray.push(_block_name_);

      var blockListArrayString = blockListeArray.join(",");

      switch (_block_type_) {
        case BlockItemType.USER:
          this.settingUtils.assignValue(
            "authorBlacklist",
            blockListArrayString,
          );
          this.refreshCss();
          showMessage(
            this.i18n.blockUserNoti.replace("${_block_name_}", _block_name_),
          );
          this.backToList();
          break;
        case BlockItemType.REPO:
          this.settingUtils.assignValue(
            "pluginBlacklist",
            blockListArrayString,
          );
          this.refreshCss();
          showMessage(
            this.i18n.blockPluginNoti.replace("${_block_name_}", _block_name_),
          );
          this.backToList();
          break;
      }

      this.settingUtils.save();
    } catch (error) {
      console.error(`Error adding current ${_block_type_} into list:`, error);
    }
  }

  reloadInterface() {
    // window.location.reload();
    showMessage(this.i18n.reload_hint);
  }

  async onload() {
    this.settingUtils = new SettingUtils(this, STORAGE_NAME);
    this.settingUtils.load();
    this.settingUtils.addItem({
      key: "totalSwitch",
      value: true,
      type: "checkbox",
      title: this.i18n.totalSwitch,
      description: this.i18n.totalSwitchDesc,
    });

    this.settingUtils.addItem({
      key: "hideMethod",
      value: 1,
      type: "select",
      title: this.i18n.hideMethodTitle,
      description: this.i18n.hideMethodDesc,
      options: {
        1: "CSS",
        2: "JS listener",
      },
    });

    this.settingUtils.addItem({
      key: "enableOneclickBlock",
      value: true,
      type: "checkbox",
      title: this.i18n.enableOneclickBlock,
      description: this.i18n.enableOneclickBlockDesc,
    });

    this.settingUtils.addItem({
      key: "pluginBlacklist",
      value: "",
      type: "textarea",
      title: this.i18n.pluginBlacklistTitle,
      description: this.i18n.pluginBlacklistDesc,
    });
    this.settingUtils.addItem({
      key: "authorBlacklist",
      value: "",
      type: "textarea",
      title: this.i18n.authorBlacklistTitle,
      description: this.i18n.authorBlacklistDesc,
    });
    this.settingUtils.addItem({
      key: "pluginBlackListNotes",
      value: "",
      type: "textarea",
      title: this.i18n.pluginBlacklistNoteTitle,
      description: this.i18n.pluginBlacklistNoteDesc,
    });
    this.settingUtils.addItem({
      key: "hint",
      value: "",
      type: "hint",
      title: this.i18n.hintTitle,
      description: this.i18n.hintDesc,
    });
    this.settingUtils.addItem({
      key: "githubToken",
      value: "",
      type: "textinput",
      title: this.i18n.githubTokenTitle,
      description: this.i18n.githubTokenDesc,
    });
    this.settingUtils.addItem({
      key: "misteryCode",
      value: "",
      type: "textinput",
      title: this.i18n.misteryCodeTitle,
      description: this.i18n.misteryCodeDesc,
    });

    const cacheData = await this.loadData(OS_CACHE_FILE);
    if (cacheData && typeof cacheData === "object") {
      this.openSourceCache = cacheData as OpenSourceCache;
    }
  }

  refreshCss() {
    if (this.settingUtils.get("totalSwitch")) {
      const _hideMethods_ = this.settingUtils.get("hideMethod");

      // console.log(typeof _hideMethods_);
      // fuck stupid type 巨坑，草

      switch (_hideMethods_) {
        case "1":
          // console.log("hide by CSS");
          this.rmvMarketPlaceCardsByNameCss(
            this.convertStringToArray(this.settingUtils.get("pluginBlacklist")),
          );

          this.rmvMarketPlaceCardsByGitHubUsernameCss(
            this.getAuthorList(),
          );
          break;
        case "2":
          // console.log("hide by JS listener");
          this.rmvMarketPlaceCardsByNameJs(
            this.convertStringToArray(this.settingUtils.get("pluginBlacklist")),
            this.getAuthorList(),
          );
          break;
        default:
          break;
      }
    }
  }

  onLayoutReady() {
    // const pollInterval = setInterval(() => {
    //   console.log("123123123");
    //   addBlockButton();
    // }, 1000);

    this.loadData(STORAGE_NAME);
    this.settingUtils.load();

    if (this.settingUtils.get("totalSwitch")) {
      const _hideMethods_ = this.settingUtils.get("hideMethod");

      // console.log(typeof _hideMethods_);
      // fuck stupid type 巨坑，草

      switch (_hideMethods_) {
        case "1":
          // console.log("hide by CSS");
          this.rmvMarketPlaceCardsByNameCss(
            this.convertStringToArray(this.settingUtils.get("pluginBlacklist")),
          );

          this.rmvMarketPlaceCardsByGitHubUsernameCss(
            this.getAuthorList(),
          );
          break;
        case "2":
          // console.log("hide by JS listener");
          this.rmvMarketPlaceCardsByNameJs(
            this.convertStringToArray(this.settingUtils.get("pluginBlacklist")),
            this.getAuthorList(),
          );
          break;
        default:
          break;
      }

      if (this.settingUtils.get("enableOneclickBlock")) {
        this.b3cardClickListener();
      }

      if (this.settingUtils.get("misteryCode") === "使用即认同：仅供个人娱乐，仅供个人参考，不作为任何结论依据，结论可能出错，开发者不反对闭源，使用者认同不滥用、不诽谤、不批评闭源插件及其作者。") {
        this.isMisteryCodeValid = true;
      }
    }
  }

  async onunload() {
    await this.settingUtils.save();
    // this.reloadInterface();
  }

  uninstall() {
    this.removeData(STORAGE_NAME);
    showMessage(this.i18n.uninstall_hint);
  }
}
