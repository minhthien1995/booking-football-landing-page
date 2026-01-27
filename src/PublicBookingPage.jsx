import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Phone, User, Search, ChevronRight } from 'lucide-react';

const PublicBookingPage = () => {
  const [step, setStep] = useState(1); // 1: Select Field, 2: Select Time, 3: Customer Info, 4: Confirmation
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApplied, setFilterApplied] = useState(false)

  const [bookingData, setBookingData] = useState({
    bookingDate: '',
    startTime: '',
    endTime: '',
    duration: 0,
    totalPrice: 0,
    customerPhone: '',
    customerName: '',
    notes: ''
  });

  // Fetch fields on mount
  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/public/fields'); // ← Update
      const data = await response.json();

      if (data.success) {
        setFields(data.data);
      }
    } catch (error) {
      console.error('Error fetching fields:', error);
      setError('Không thể tải danh sách sân');
    } finally {
      setLoading(false);
    }
  };

  // ⭐ NEW: Search available fields
  const handleSearchAvailableFields = async () => {
    if (!bookingData.bookingDate || !bookingData.startTime || !bookingData.endTime) {
      setError('Vui lòng chọn đầy đủ ngày và giờ');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `http://localhost:5000/api/public/fields/search-available?date=${bookingData.bookingDate}&startTime=${bookingData.startTime}&endTime=${bookingData.endTime}`
      );
      const data = await response.json();

      if (data.success) {
        setFields(data.data.availableFields);
        setFilterApplied(true);

        // Show notification
        if (data.data.availableFields.length === 0) {
          setError('Không có sân trống vào thời gian này. Vui lòng chọn thời gian khác.');
        }
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Không thể tìm sân. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ⭐ NEW: Clear filter
  const handleClearFilter = () => {
    setBookingData({
      ...bookingData,
      bookingDate: '',
      startTime: '',
      endTime: '',
      duration: 0,
      totalPrice: 0
    });
    setFilterApplied(false);
    fetchFields(); // Reload all fields
  };

  // Calculate duration and price
  useEffect(() => {
    if (bookingData.startTime && bookingData.endTime && selectedField) {
      const start = parseTime(bookingData.startTime);
      const end = parseTime(bookingData.endTime);

      if (end > start) {
        const duration = (end - start) / 60;
        const totalPrice = duration * selectedField.pricePerHour;

        setBookingData(prev => ({
          ...prev,
          duration,
          totalPrice
        }));
      }
    }
  }, [bookingData.startTime, bookingData.endTime, selectedField]);

  const parseTime = (timeString) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatPhone = (phone) => {
    return phone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const handleFieldSelect = (field) => {
    setSelectedField(field);
    setStep(2);
  };

  const handleNextToCustomerInfo = () => {
    if (!bookingData.bookingDate || !bookingData.startTime || !bookingData.endTime) {
      setError('Vui lòng chọn đầy đủ ngày và giờ');
      return;
    }
    if (bookingData.duration <= 0) {
      setError('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate
    if (!bookingData.customerPhone || !bookingData.customerName) {
      setError('Vui lòng nhập đầy đủ thông tin');
      setLoading(false);
      return;
    }

    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(bookingData.customerPhone.replace(/\s/g, ''))) {
      setError('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Find or create customer (PUBLIC endpoint)
      const customerResponse = await fetch('http://localhost:5000/api/public/customers/find-or-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: bookingData.customerPhone.replace(/\s/g, ''),
          fullName: bookingData.customerName
        })
      });

      const customerData = await customerResponse.json();

      if (!customerResponse.ok) {
        throw new Error(customerData.message || 'Không thể xử lý thông tin');
      }

      const userId = customerData.data.customer.id;

      // Step 2: Create booking (PUBLIC endpoint)
      const bookingResponse = await fetch('http://localhost:5000/api/public/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId,
          fieldId: selectedField.id,
          bookingDate: bookingData.bookingDate,
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          duration: bookingData.duration,
          totalPrice: bookingData.totalPrice,
          notes: bookingData.notes
        })
      });

      const bookingResult = await bookingResponse.json();

      if (!bookingResponse.ok) {
        if (bookingResult.conflict) {
          throw new Error(`Khung giờ đã được đặt! Vui lòng chọn giờ khác.`);
        }
        throw new Error(bookingResult.message || 'Không thể đặt sân');
      }

      // Success - Show confirmation
      setStep(4);
    } catch (err) {
      setError(err.message);
      alert(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedField(null);
    setBookingData({
      bookingDate: '',
      startTime: '',
      endTime: '',
      duration: 0,
      totalPrice: 0,
      customerPhone: '',
      customerName: '',
      notes: ''
    });
    setError('');
  };

  const filteredFields = fields.filter(field =>
    field.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            ⚽ Đặt Sân Bóng
          </h1>
          <p className="text-slate-600 mt-2">Đặt sân nhanh chóng, dễ dàng - Không cần tài khoản</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Chọn sân', icon: MapPin },
              { num: 2, label: 'Chọn giờ', icon: Clock },
              { num: 3, label: 'Thông tin', icon: User },
              { num: 4, label: 'Xác nhận', icon: Calendar }
            ].map((s, idx) => {
              const Icon = s.icon;
              return (
                <React.Fragment key={s.num}>
                  <div className="flex flex-col items-center">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold transition ${step >= s.num
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'bg-slate-200 text-slate-600'
                      }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-sm mt-2 font-medium ${step >= s.num ? 'text-purple-600' : 'text-slate-400'
                      }`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div className={`flex-1 h-1 mx-4 rounded transition ${step > s.num ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-slate-200'
                      }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Step 1: Select Field */}
        {step === 1 && (
          <div>
            {/* Search Box */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm sân theo tên hoặc địa điểm..."
                  className="w-full pl-12 pr-4 py-4 text-lg border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* ⭐ NEW: Date/Time Filter */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-lg p-6 mb-6 border-2 border-purple-200">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-slate-900">Tìm sân trống theo thời gian</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ngày
                  </label>
                  <input
                    type="date"
                    value={bookingData.bookingDate}
                    onChange={(e) => setBookingData({ ...bookingData, bookingDate: e.target.value })}
                    min={getTodayDate()}
                    className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Giờ bắt đầu
                  </label>
                  <input
                    type="time"
                    value={bookingData.startTime}
                    onChange={(e) => setBookingData({ ...bookingData, startTime: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Giờ kết thúc
                  </label>
                  <input
                    type="time"
                    value={bookingData.endTime}
                    onChange={(e) => setBookingData({ ...bookingData, endTime: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Search Button */}
              <div className="mt-4 flex items-center gap-4">
                <button
                  onClick={handleSearchAvailableFields}
                  disabled={!bookingData.bookingDate || !bookingData.startTime || !bookingData.endTime || loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Đang tìm...' : '🔍 Tìm sân trống'}
                </button>

                {(bookingData.bookingDate || bookingData.startTime || bookingData.endTime) && (
                  <button
                    onClick={handleClearFilter}
                    className="px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>

              {/* Duration & Price Preview */}
              {bookingData.duration > 0 && (
                <div className="mt-4 bg-white rounded-xl p-4 border-2 border-purple-200">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-slate-600">Thời gian thuê: </span>
                      <span className="font-bold text-purple-600">{bookingData.duration} giờ</span>
                    </div>
                    <div>
                      <span className="text-slate-600">Ước tính giá: </span>
                      <span className="font-bold text-purple-600">Tùy sân</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Filter Results Info */}
            {filterApplied && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900">
                      Đang hiển thị sân trống vào {new Date(bookingData.bookingDate).toLocaleDateString('vi-VN')}
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Thời gian: {bookingData.startTime} - {bookingData.endTime} ({bookingData.duration} giờ)
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Tìm thấy <span className="font-bold">{filteredFields.length}</span> sân có thể đặt
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Select Time */}
            {step === 2 && selectedField && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="bg-purple-50 rounded-xl p-6 mb-8">
                  <div className="flex items-center gap-4 mb-3">
                    <MapPin className="w-6 h-6 text-purple-600" />
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{selectedField.name}</h3>
                      <p className="text-slate-600">{selectedField.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-purple-200">
                    <span className="text-slate-600">Giá thuê:</span>
                    <span className="text-2xl font-bold text-purple-600">
                      {formatCurrency(selectedField.pricePerHour)}/giờ
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="flex items-center gap-2 text-lg font-medium text-slate-700 mb-3">
                      <Calendar className="w-5 h-5" />
                      Chọn ngày
                    </label>
                    <input
                      type="date"
                      value={bookingData.bookingDate}
                      onChange={(e) => setBookingData({ ...bookingData, bookingDate: e.target.value })}
                      min={getTodayDate()}
                      className="w-full px-6 py-4 text-lg border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="flex items-center gap-2 text-lg font-medium text-slate-700 mb-3">
                        <Clock className="w-5 h-5" />
                        Giờ bắt đầu
                      </label>
                      <input
                        type="time"
                        value={bookingData.startTime}
                        onChange={(e) => setBookingData({ ...bookingData, startTime: e.target.value })}
                        className="w-full px-6 py-4 text-lg border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-lg font-medium text-slate-700 mb-3">
                        <Clock className="w-5 h-5" />
                        Giờ kết thúc
                      </label>
                      <input
                        type="time"
                        value={bookingData.endTime}
                        onChange={(e) => setBookingData({ ...bookingData, endTime: e.target.value })}
                        className="w-full px-6 py-4 text-lg border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {bookingData.duration > 0 && (
                    <div className="bg-blue-50 rounded-xl p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-600 mb-1">Thời gian thuê</p>
                          <p className="text-3xl font-bold text-blue-900">{bookingData.duration} giờ</p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-600 mb-1">Tổng tiền</p>
                          <p className="text-3xl font-bold text-purple-600">
                            {formatCurrency(bookingData.totalPrice)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setStep(1)}
                    className="px-8 py-4 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition"
                  >
                    Quay lại
                  </button>
                  <button
                    onClick={handleNextToCustomerInfo}
                    className="flex-1 px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 shadow-lg transition"
                  >
                    Tiếp tục
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Customer Info */}
            {step === 3 && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Thông tin của bạn</h2>

                <div className="bg-blue-50 rounded-xl p-6 mb-8">
                  <div className="flex items-start gap-3">
                    <Phone className="w-6 h-6 text-blue-600 mt-1" />
                    <div>
                      <p className="font-semibold text-slate-900 mb-2">Đặt sân không cần tài khoản</p>
                      <p className="text-sm text-slate-600">
                        Chỉ cần nhập số điện thoại và họ tên. Chúng tôi sẽ tự động tạo tài khoản cho bạn để quản lý booking.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="flex items-center gap-2 text-lg font-medium text-slate-700 mb-3">
                      <Phone className="w-5 h-5" />
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      value={bookingData.customerPhone}
                      onChange={(e) => setBookingData({ ...bookingData, customerPhone: e.target.value })}
                      className="w-full px-6 py-4 text-lg border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="0901234567"
                      maxLength="10"
                      required
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-lg font-medium text-slate-700 mb-3">
                      <User className="w-5 h-5" />
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      value={bookingData.customerName}
                      onChange={(e) => setBookingData({ ...bookingData, customerName: e.target.value })}
                      className="w-full px-6 py-4 text-lg border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Nguyễn Văn A"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-lg font-medium text-slate-700 mb-3 block">
                      Ghi chú (tùy chọn)
                    </label>
                    <textarea
                      value={bookingData.notes}
                      onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                      className="w-full px-6 py-4 text-lg border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows="3"
                      placeholder="Thêm ghi chú cho booking..."
                    />
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={loading}
                      className="px-8 py-4 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
                    >
                      Quay lại
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-600 shadow-lg transition disabled:opacity-50 text-lg"
                    >
                      {loading ? 'Đang xử lý...' : 'Xác nhận đặt sân'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Calendar className="w-10 h-10 text-green-600" />
                </div>

                <h2 className="text-3xl font-bold text-slate-900 mb-3">🎉 Đặt sân thành công!</h2>
                <p className="text-lg text-slate-600 mb-8">
                  Cảm ơn bạn đã đặt sân. Chúng tôi đã gửi thông tin xác nhận đến số điện thoại của bạn.
                </p>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 mb-8 text-left">
                  <h3 className="text-xl font-bold text-slate-900 mb-6">Thông tin đặt sân</h3>

                  <div className="space-y-4">
                    <div className="flex justify-between py-3 border-b border-purple-200">
                      <span className="text-slate-600">Sân:</span>
                      <span className="font-semibold text-slate-900">{selectedField.name}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-purple-200">
                      <span className="text-slate-600">Ngày:</span>
                      <span className="font-semibold text-slate-900">
                        {new Date(bookingData.bookingDate).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-purple-200">
                      <span className="text-slate-600">Giờ:</span>
                      <span className="font-semibold text-slate-900">
                        {bookingData.startTime} - {bookingData.endTime}
                      </span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-purple-200">
                      <span className="text-slate-600">Khách hàng:</span>
                      <span className="font-semibold text-slate-900">{bookingData.customerName}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-purple-200">
                      <span className="text-slate-600">Số điện thoại:</span>
                      <span className="font-semibold text-slate-900">
                        {formatPhone(bookingData.customerPhone)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-6 mt-6 border-t-2 border-purple-300">
                      <span className="text-xl font-semibold text-slate-900">Tổng tiền:</span>
                      <span className="text-4xl font-bold text-purple-600">
                        {formatCurrency(bookingData.totalPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 shadow-lg transition text-lg"
                >
                  Đặt sân khác
                </button>
              </div>
            )}
          </div>
    </div>
      );
};

      export default PublicBookingPage;