# claude-mods

Mod cá nhân cho Claude Code.

## usage-band

Luôn hiện mức usage của session ngay phía trên ô nhập prompt, không cần mở Settings:

- **Context**: phần trăm cửa sổ context đang dùng, kèm số token / tổng.
- **5h / 7 ngày**: mức dùng hạn mức gói, kèm thời gian đến lúc reset.
- **Token**: tổng token vào (↑) / ra (↓) cộng dồn qua các lượt, tính cả subagent.
- **Chi phí**: tổng $ của session.

Thanh đo đổi màu: xanh dưới 70%, vàng từ 70%, đỏ từ 90%.
Trên app điện thoại (Remote Control) và VS Code, số liệu hiện trong pane **Usage**.

## Cài đặt

Repo này là private: máy cài cần đăng nhập GitHub bằng tài khoản có quyền đọc repo
(`gh auth login`, rồi `gh auth setup-git`).

Tại prompt của Claude Code trong terminal:

```
/plugin install usage-band --marketplace hoanglm187/claude-mods
```

Từ shell:

```
claude plugin install usage-band --marketplace hoanglm187/claude-mods
```

Trong app desktop (nơi `/plugin` không chạy): bấm **+** cạnh ô prompt → **Plugins** →
**Add marketplace** với `hoanglm187/claude-mods` → **Add plugin**.

### Session cloud

Thêm vào `.claude/settings.json` của repo mà session cloud chạy từ đó:

```json
{
  "extraKnownMarketplaces": {
    "claude-mods": {
      "source": { "source": "github", "repo": "hoanglm187/claude-mods" }
    }
  },
  "enabledPlugins": {
    "usage-band@claude-mods": true
  }
}
```

### Cập nhật

```
claude plugin marketplace update claude-mods
claude plugin update usage-band@claude-mods
```

Rồi chạy `/reload-plugins` trong session đang mở.
