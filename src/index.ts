import { Plugin, showMessage } from "siyuan";
import "@/index.scss";

import { SettingUtils } from "./libs/setting-utils";

const STORAGE_NAME = "menu-config";

var packageNameClass = document.getElementsByClassName("ft__on-surface");

enum BlockItemType {
  USER = "USER",
  REPO = "REPO",
}

export default class siyuan_rmv_btn extends Plugin {
  private settingUtils: SettingUtils;

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

  applyStyles(css) {
    // console.log("applyStyles");
    // console.log(css);
    const head = document.head || document.getElementsByTagName("head")[0];
    const style = document.createElement("style");
    head.appendChild(style);
    style.appendChild(document.createTextNode(css));
  }

  rmvMarketPlaceCardsByNameJs(_toRemoveListArray_) {
    var siyuanMarketPlaceObserver = new MutationObserver(function (
      mutationsList,
      observer,
    ) {
      for (var i = 0; i < packageNameClass.length; i++) {
        if (_toRemoveListArray_.includes(packageNameClass[i].textContent)) {
          if (packageNameClass[i].closest(".b3-card--wrap")) {
            packageNameClass[i].closest(".b3-card--wrap").style.display =
              "none";
          }
        }
      }
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
     * .b3-card.b3-card--wrap[data-obj*='"name":"siyuan_global_zoom"'] {
     *        display: none;
     * }
     *
     *
     */

    var _arr_with_css_ = [];
    for (var i = 0; i < _toRemovePackageNameListArray_.length; i++) {
      _arr_with_css_.push(
        `.b3-card.b3-card--wrap[data-obj*='"name":"${_toRemovePackageNameListArray_[i]}"'] {
            display: none;
        }`,
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
     * .b3-card.b3-card--wrap[data-obj*='"repoURL":"https://github.com/${_toRemoveListArray_[i]}/'] {
     */

    var _arr_with_css_ = [];

    for (var i = 0; i < _toRemoveGitHubUsernameListArray_.length; i++) {
      _arr_with_css_.push(
        `.b3-card.b3-card--wrap[data-obj*='"repoURL":"https://github.com/${_toRemoveGitHubUsernameListArray_[i]}/'] {
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
    console.log("called");
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
      console.log("click card callback");
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

    const existingButtons = document.querySelectorAll(
      '[zxkmm_global_identifier="new_added_element"]',
    );

    if (existingButtons.length > 0) {
      console.log("Elements already exist, removing and re-adding");
      console.log(existingButtons);
      existingButtons.forEach((elem) => elem.remove());
    }

    console.log("add btn");
    console.log("222");
    const feedbackButton = document.querySelector('a[data-type="feedback"]'); // feed back icon
    console.log("feedbackbtn", feedbackButton);

    if (feedbackButton) {
      const blockPluginBtn = document.createElement("a");
      blockPluginBtn.title = "集市黑名单：拉黑这个插件";
      blockPluginBtn.className = "b3-button b3-button--blacklist"; //TODO: write and use another btn css
      blockPluginBtn.style.width = "168px";
      blockPluginBtn.textContent = "拉黑插件";
      blockPluginBtn.setAttribute(
        "zxkmm_global_identifier",
        "new_added_element",
      );

      const blockAuthorBtn = document.createElement("a");
      blockAuthorBtn.title = "集市黑名单：拉黑这个作者";
      blockAuthorBtn.className = "b3-button b3-button--blacklist";
      blockAuthorBtn.style.width = "168px";
      blockAuthorBtn.textContent = "拉黑作者";
      blockAuthorBtn.setAttribute(
        "zxkmm_global_identifier",
        "new_added_element",
      );

      ///v callback listener and worker
      blockPluginBtn.onclick = (event: Event) => {
        event.preventDefault();
        // idk how siyuan listen the click callback
        // but just in case and also in case it changed in the future....
        console.log("click callback TODO TODO TODO!!");
        const userName = this.fetchGithubRepoForCurrentDisplayItem();
        this.appendCurrentItemIntoList(BlockItemType.REPO, userName);
      };

      blockAuthorBtn.onclick = (event: Event) => {
        event.preventDefault(); //
        console.log("click callback TODO TODO TODO!!");
        const userName = this.fetchGithubUserForCurrentDisplayItem();
        this.appendCurrentItemIntoList(BlockItemType.USER, userName);
      };
      ///^

      const separator = document.createElement("div");
      separator.className = "fn__hr--b";
      separator.setAttribute("zxkmm_global_identifier", "new_added_element");

      const separator1 = document.createElement("div");
      separator1.className = "fn__hr--b";
      separator1.setAttribute("zxkmm_global_identifier", "new_added_element");

      const parentDiv = feedbackButton.parentElement;
      console.log("parentDiv:", parentDiv);

      if (parentDiv) {
        console.log("addded btnnn");
        // feed back btn pos
        parentDiv.appendChild(separator);
        parentDiv.appendChild(blockPluginBtn);
        parentDiv.appendChild(separator1);
        parentDiv.appendChild(blockAuthorBtn);
        //repo etc pos
      }
    }
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
          showMessage(`已拉黑${_block_name_}的所有插件`);
          this.backToList();
          break;
        case BlockItemType.REPO:
          this.settingUtils.assignValue(
            "pluginBlacklist",
            blockListArrayString,
          );
          this.refreshCss();
          showMessage(`已拉黑${_block_name_}插件`);
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
            this.convertStringToArray(this.settingUtils.get("authorBlacklist")),
          );
          break;
        case "2":
          // console.log("hide by JS listener");
          this.rmvMarketPlaceCardsByNameJs(
            this.convertStringToArray(this.settingUtils.get("pluginBlacklist")),
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
            this.convertStringToArray(this.settingUtils.get("authorBlacklist")),
          );
          break;
        case "2":
          // console.log("hide by JS listener");
          this.rmvMarketPlaceCardsByNameJs(
            this.convertStringToArray(this.settingUtils.get("pluginBlacklist")),
          );
          break;
        default:
          break;
      }

      this.b3cardClickListener();
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
