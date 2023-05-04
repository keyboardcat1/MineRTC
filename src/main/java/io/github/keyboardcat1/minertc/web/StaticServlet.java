package io.github.keyboardcat1.minertc.web;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;

public class StaticServlet extends HttpServlet {

    public void doGet(HttpServletRequest req, HttpServletResponse res) throws IOException {
        //serve resources/static/*
        String fileName = req.getPathInfo();
        InputStream is = this.getClass().getClassLoader().getResourceAsStream("static" + fileName);

        if (is == null) {
            res.sendError(404);
            return;
        }

        is.transferTo(res.getOutputStream());
    }
}
