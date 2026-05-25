package cn.toside.music.mobile;

import android.content.Intent;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;

public class SplashActivity extends AppCompatActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // 跳转到 MainActivity
    Intent intent = new Intent(this, MainActivity.class);
    startActivity(intent);

    // 结束当前 Activity
    finish();
  }
}
