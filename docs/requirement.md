https://phongtruyenthong.bidv.com.vn/ đây là 1 mô hình phòng truyền thống số của BIDV, sếp tôi thấy nó khá hay và kêu tôi chuẩn bị 1 phòng truyền thống số tương tự chuẩn bị lễ kỷ niệm 50 năm thành lập công ty, source vào sẽ là các file hình cũ từ 50 năm trước tới nay, tôi nghĩ sẽ gom lại theo từng thời kỳ, nên sẽ đi theo thời kỳ

Tôi cần research để xây dựng được 1 project như thế nào, chọn loại thư viện nào, do tôi có bị các anh senior cảnh báo về vấn đề khung 3D render rất nặng khiến cho server nội bộ của tôi yếu đối (tầm 4-8GB RAM) không gánh được nên rất chậm, hoặc là tôi sẽ tiếp tục sử dụng server đó hoặc là nên sử dụng các thứ miễn phí có thể sử dụng bên ngoài, nên chọn cái nào bây giờ.

1 anh leader khác của tôi có cho tôi xem thử bản demo của ảnh tại trang https://phatvo.github.io/reactvr/ như hình thứ 6, điểm hay của sản phẩm ảnh là xài nguồn free và hosting từ github pages nên không tốn tiền, và có thể mở trên mobile sau đó sử dụng con lăn của điện thoại để bật tính năng Cảm biến, xoay điện thoại là thấy cảnh vật xung quanh (1 điểm cộng nhưng không phải là yêu cầu bắt buộc), nhưng điểm xấu với đó là các ảnh sử dụng như nhìn phía trước mặt chứ không có chiều sâu 3D, với lại cũng chỉ là 1 view ảnh 360 thôi chứ không phải như cái truyền thống phía trên của BIDV,

1 ý kiến khác từ 1 anh leader khác là sử dụng artstep https://www.artsteps.com/view/654fb2a1c1189beaf73587f7 để tạo phòng số, nhưng tôi cũng sợ về kinh phí và khả năng loading ảnh của nó lên, có thể lên tới 100-200 tấm hình trong nhiều căn phòng số

chốt lại 1 số ý tưởng của tôi như sau:

- đối với người tham quan công ty tôi, có thể mở trang web ra coi được sản phẩm
- đối với người chuẩn bị resource hình, content chữ, tôi nghĩ tôi nên tạo ra các block chứa ảnh (kiểu block trắng), rồi nhiệm vụ của người đó là chọn ảnh bỏ vào danh sách block đó là xong, dễ thay đổi tấm hình khác ở vị trí cố định luôn
- đối với người thiết kế căn phòng, nếu xài được model phòng nào có sẵn thì càng tốt, không thì tôi sẽ nhờ agent tạo thử (miễn là có thư viện hỗ trợ điều đó) - và thư viện nào cho phép tôi làm điều đó cũng là vấn đề. Điểm tốt hơn là nếu có thể chèn vào các bức tường những hoa văn, những kiểu tường mà tôi mong muốn thì càng tốt. nếu có cần resource hình để làm tường hay gì đó, tôi sẽ cân nhắc nhờ agent tạo ảnh cho tôi, còn đối với model 3D thì cần cân nhắc vì có thể nặng hay không
- đối với coding và hệ thống: tôi muốn hiệu suất tốt, dễ làm, khả năng toàn bộ phần code tôi sẽ đưa agent làm hết, miễn sao là thư viện có hỗ trợ cho tôi là được, cần sử dụng hệ nào free thì càng tốt, như supbabase, vercel, githubpage,...? có cái nào hỗ trợ không, hay tôi đành phải sử dụng server của mình giờ

bắt đầu phân tích, đưa ra bản thiết kế cho tôi cần làm những gì, để tôi đưa vào agent bản kế hoạch đó là ra được sản phẩm luôn

phần khảo sát thư viện, cân nhắc có 3D thì tốt, hoặc không thì chuyển hướng luôn giúp tôi, trang web https://phatvo.github.io/reactvr/ này viết bằng Vite + React Three Fiber -> tất nhiên có thể có hạn chế, xem xét liệu thực sự tôi có cần model 3D gì hay không, hay đơn giản là bỏ hình vào là xong?