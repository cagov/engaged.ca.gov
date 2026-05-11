document.addEventListener('DOMContentLoaded', function() {

  // ── Collapse/expand toggle (Bootstrap-style) ──────────────────────────
  document.querySelectorAll('[data-toggle="collapse"]').forEach(function(trigger) {
    trigger.addEventListener('click', function(e) {
      e.preventDefault();
      var targetSel = trigger.getAttribute('data-target');
      var target = document.querySelector(targetSel);
      if (!target) return;

      if (target.classList.contains('in')) {
        target.classList.remove('in');
        target.style.display = 'none';
        trigger.classList.add('collapsed');
        trigger.setAttribute('aria-expanded', 'false');
      } else {
        target.classList.add('in');
        target.style.display = '';
        trigger.classList.remove('collapsed');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Initialize collapsed sections
  document.querySelectorAll('.collapse:not(.in)').forEach(function(el) {
    el.style.display = 'none';
  });

  // ── Show more comments (per-project batch size) ────────────────────────
  document.querySelectorAll('.show-more-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var targetId = btn.getAttribute('data-target');
      var container = document.getElementById(targetId);
      if (!container) return;

      var batchSize = parseInt(container.getAttribute('data-batch-size')) || 10;

      var hiddenComments = container.querySelectorAll(':scope > .comment-item-container.hidden-comment');
      var showing = 0;
      hiddenComments.forEach(function(el) {
        if (showing < batchSize) {
          el.classList.remove('hidden-comment');
          el.style.display = '';
          showing++;
        }
      });

      var remaining = container.querySelectorAll(':scope > .comment-item-container.hidden-comment');
      if (remaining.length === 0) {
        btn.style.display = 'none';
      } else {
        var total = container.querySelectorAll(':scope > .comment-item-container').length;
        btn.textContent = total + ' Comments - View ' + remaining.length + ' more Comments';
      }
    });
  });

  // ── Show more replies ──────────────────────────────────────────────────
  document.querySelectorAll('.show-more-replies-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var parent = btn.parentNode;
      var hiddenReplies = parent.querySelectorAll(':scope > .comment-reply.hidden-reply');
      hiddenReplies.forEach(function(el) {
        el.classList.remove('hidden-reply');
        el.style.display = '';
      });
      btn.style.display = 'none';
    });
  });

  // ── Mobile drawer toggle ──────────────────────────────────────────────
  var drawerToggle = document.querySelector('.drawer-toggle');
  if (drawerToggle) {
    drawerToggle.addEventListener('click', function(e) {
      e.preventDefault();
      document.body.classList.toggle('drawer-open');
    });
  }

  var underlay = document.querySelector('.side-drawer-underlay');
  if (underlay) {
    underlay.addEventListener('click', function() {
      document.body.classList.remove('drawer-open');
    });
  }

  document.querySelectorAll('a.disabled-link').forEach(function(el) {
    el.setAttribute('aria-disabled', 'true');
    el.addEventListener('click', function(e) {
      e.preventDefault();
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
      }
    });
  });
});
