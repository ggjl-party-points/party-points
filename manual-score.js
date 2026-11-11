(function () {
  'use strict';

  function element(id) {
    return document.getElementById(id);
  }

  function canAdjust(fields) {
    return fields.scoringType !== 'volunteer' && fields.scoringType !== 'volunteer-record';
  }

  function adjusted(fields, category, input, reason) {
    const points = Number(input);
    if (!canAdjust(fields)) throw Error('这类志愿材料按累计时长计分。');
    if (!input.trim() || !Number.isFinite(points) || Math.abs(points) > 100 ||
        (category === 'dc' ? points > 0 : points < 0)) {
      throw Error(category === 'dc' ? '请输入 −100 至 0 的扣分。' : '请输入 0 至 100 的分数。');
    }
    if (!reason.trim()) throw Error('请填写调整原因。');
    return Object.assign({}, fields, {
      score: points,
      manualScore: { ruleScore: fields.score, reason: reason.trim() }
    });
  }

  const originalFields = scoringFields;
  scoringFields = function (prefix) {
    return originalFields(prefix) +
      '<details class="fg" id="' + prefix + 'ManualPanel"><summary>自定义本条分数</summary>' +
      '<label for="' + prefix + 'ManualPoints">实际计入分数（留空则按规则）</label>' +
      '<input type="number" step="any" id="' + prefix + 'ManualPoints">' +
      '<label for="' + prefix + 'ManualReason">调整原因</label>' +
      '<input maxlength="200" id="' + prefix + 'ManualReason"></details>';
  };

  const originalBind = bindScoringFields;
  bindScoringFields = function (prefix, category, index, item) {
    const read = originalBind(prefix, category, index, item);
    const points = element(prefix + 'ManualPoints');
    const reason = element(prefix + 'ManualReason');
    const panel = element(prefix + 'ManualPanel');
    if (!points || !reason || !panel) return read;
    const type = element(prefix + 'Type');
    const level = element(prefix + 'Lv');
    function update() {
      panel.hidden = !canAdjust({ scoringType: type.value });
    }
    [type, level].forEach(function (control) {
      const onChange = control.onchange;
      control.onchange = function () {
        onChange.call(this);
        points.value = '';
        reason.value = '';
        update();
      };
    });
    points.value = item && item.manualScore && item.ruleOption != null ? String(item.score) : '';
    reason.value = points.value ? item.manualScore.reason : '';
    panel.open = Boolean(points.value);
    update();
    return function () {
      const fields = read();
      return !panel.hidden && points.value !== ''
        ? adjusted(fields, category, points.value, reason.value)
        : fields;
    };
  };

  const originalGuard = guardModalDraft;
  guardModalDraft = function (ids) {
    const extra = ['e', 'f'].flatMap(function (prefix) {
      return [prefix + 'ManualPoints', prefix + 'ManualReason'];
    }).filter(element);
    originalGuard(ids.concat(extra));
  };

  const originalBatchRead = readBatchScoring;
  readBatchScoring = function (prefix) {
    const fields = originalBatchRead(prefix);
    const override = element(prefix + 'Level').manualScore;
    return override
      ? adjusted(fields, element(prefix + 'Cat').value.split('-')[0], override.points, override.reason)
      : fields;
  };

  function openBatchScore(prefix, level, button) {
    const fields = originalBatchRead(prefix);
    const category = element(prefix + 'Cat').value.split('-')[0];
    const dialog = document.createElement('dialog');
    dialog.className = 'ai-import-dialog';
    dialog.setAttribute('aria-labelledby', 'manualBatchTitle');
    dialog.innerHTML = '<div class="ai-import-shell"><header><h2 id="manualBatchTitle">批量自定义分数</h2></header>' +
      '<div class="ai-import-body"><p>规则分数为 ' + fmt(fields.score) + ' 分。每条选中的材料将使用同一分数。</p>' +
      '<form id="manualBatchForm"><div class="fg"><label for="manualBatchPoints">每条实际计入分数</label>' +
      '<input id="manualBatchPoints" type="number" step="any" required></div>' +
      '<div class="fg"><label for="manualBatchReason">调整原因</label><input id="manualBatchReason" maxlength="200" required></div>' +
      '<p id="manualBatchError" role="alert"></p></form></div>' +
      '<footer><button class="btn" id="manualBatchCancel">取消</button><button class="btn" id="manualBatchReset">恢复规则计分</button>' +
      '<button class="btn btn-p" type="submit" form="manualBatchForm">采用分数</button></footer></div>';
    document.body.appendChild(dialog);
    dialog.addEventListener('close', function () { dialog.remove(); button.focus(); });
    const points = element('manualBatchPoints');
    const reason = element('manualBatchReason');
    points.value = level.manualScore ? level.manualScore.points : String(fields.score);
    reason.value = level.manualScore ? level.manualScore.reason : '';
    element('manualBatchCancel').onclick = function () { dialog.close(); };
    element('manualBatchReset').onclick = function () {
      delete level.manualScore;
      button.textContent = '自定义分数';
      dialog.close();
    };
    element('manualBatchForm').onsubmit = function (event) {
      event.preventDefault();
      try {
        const result = adjusted(fields, category, points.value, reason.value);
        level.manualScore = { points: points.value, reason: reason.value };
        button.textContent = '每条 ' + fmt(result.score) + ' 分（自定义）';
        dialog.close();
      } catch (error) {
        element('manualBatchError').textContent = error.message;
      }
    };
    dialog.showModal();
    points.focus();
  }

  const originalConfigure = configureBatchScoring;
  configureBatchScoring = function (prefix) {
    originalConfigure(prefix);
    const level = element(prefix + 'Level');
    const category = element(prefix + 'Cat');
    if (!level || !category || !level.insertAdjacentHTML) return;
    let button = element(prefix + 'ManualButton');
    if (!button) {
      level.insertAdjacentHTML('afterend', '<button type="button" class="btn btn-s" id="' +
        prefix + 'ManualButton">自定义分数</button>');
      button = element(prefix + 'ManualButton');
      button.onclick = function () {
        try { openBatchScore(prefix, level, button); }
        catch (error) { alert(error.message); }
      };
    }
    function reset() {
      delete level.manualScore;
      const choice = category.value && level._scoringChoices && level._scoringChoices[Number(level.value)];
      button.hidden = !choice || !canAdjust({ scoringType: choice.profile.id });
      button.textContent = '自定义分数';
    }
    const onChange = level.onchange;
    level.onchange = function () {
      if (onChange) onChange.call(this);
      reset();
    };
    reset();
  };

  const originalAssign = assignScoringItem;
  assignScoringItem = function (item, raw, fields) {
    if (!fields.manualScore) delete item.manualScore;
    return originalAssign(item, raw, fields);
  };
  const originalRemember = rememberScoring;
  rememberScoring = function (raw, category, index, item) {
    if (!item.manualScore) originalRemember(raw, category, index, item);
  };
  const originalIssue = scoringIssue;
  scoringIssue = function (category, index, item) {
    if (item.auto === false && item.manualScore) return '';
    return originalIssue(category, index, item);
  };
})();
